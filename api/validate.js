import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // CORS is handled by vercel.json, but just in case for preflight:
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { licenseKey, deviceId } = req.body;
    if (!licenseKey || !deviceId) {
      return res.status(400).json({ valid: false, error: 'Missing parameters' });
    }

    // 1. Find License
    const { data: license, error: licErr } = await supabase
      .from('licenses')
      .select('id, is_active, max_devices, expires_at')
      .eq('key_string', licenseKey)
      .single();

    if (licErr || !license || !license.is_active) {
      return res.status(200).json({ valid: false, error: 'Invalid or revoked license' });
    }

    // Check expiration
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return res.status(200).json({ valid: false, error: 'License expired' });
    }

    // 2. Count active devices (heartbeat in last 2 hours)
    const activeCutoff = new Date(Date.now() - 120 * 60 * 1000).toISOString();
    const { count: activeCount } = await supabase
      .from('devices')
      .select('id', { count: 'exact' })
      .eq('license_id', license.id)
      .gte('last_heartbeat', activeCutoff);

    // 3. Check if THIS device is registered
    const { data: existingDevice } = await supabase
      .from('devices')
      .select('id')
      .eq('license_id', license.id)
      .eq('device_id', deviceId)
      .single();

    if (!existingDevice && activeCount >= license.max_devices) {
      return res.status(200).json({ valid: false, error: 'Device limit reached' });
    }

    // 4. Register or update device
    if (existingDevice) {
      await supabase
        .from('devices')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('id', existingDevice.id);
    } else {
      await supabase
        .from('devices')
        .insert({
          license_id: license.id,
          device_id: deviceId,
          last_heartbeat: new Date().toISOString()
        });
    }

    return res.status(200).json({ valid: true, max_devices: license.max_devices });
  } catch (error) {
    console.error('Validation error:', error);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
}

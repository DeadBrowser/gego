import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { licenseKey, deviceId, geo } = req.body;
    if (!licenseKey || !deviceId) {
      return res.status(400).json({ valid: false, error: 'Missing parameters' });
    }

    // 1. Find License
    const { data: license, error: licErr } = await supabase
      .from('licenses')
      .select('id, is_active, expires_at')
      .eq('key_string', licenseKey)
      .single();

    if (licErr || !license || !license.is_active) {
      return res.status(200).json({ valid: false, error: 'Invalid or revoked license' });
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return res.status(200).json({ valid: false, error: 'License expired' });
    }

    // 2. Update Device Heartbeat and Geo info
    const { data: existingDevice } = await supabase
      .from('devices')
      .select('id')
      .eq('license_id', license.id)
      .eq('device_id', deviceId)
      .single();

    if (existingDevice) {
      await supabase
        .from('devices')
        .update({ 
          last_heartbeat: new Date().toISOString(),
          last_geo: geo || 'Unknown'
        })
        .eq('id', existingDevice.id);
      return res.status(200).json({ valid: true });
    } else {
      // Ifdevice dropped but license is valid, re-register if we want. 
      // For now, let's treat it as a valid ping but insert it.
      await supabase
        .from('devices')
        .insert({
          license_id: license.id,
          device_id: deviceId,
          last_geo: geo || 'Unknown',
          last_heartbeat: new Date().toISOString()
        });
      return res.status(200).json({ valid: true });
    }

  } catch (error) {
    console.error('Heartbeat error:', error);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
}

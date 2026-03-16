import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { licenseKey, deviceId, domain } = req.body;
    if (!licenseKey || !deviceId || !domain) {
      return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    // Verify license and get ID
    const { data: license, error: licErr } = await supabase
      .from('licenses')
      .select('id, is_active')
      .eq('key_string', licenseKey)
      .single();

    if (licErr || !license || !license.is_active) {
      return res.status(401).json({ success: false, error: 'Invalid license' });
    }

    // Insert log
    const { error: insertErr } = await supabase
      .from('visit_logs')
      .insert({
        license_id: license.id,
        device_id: deviceId,
        domain: domain
      });

    if (insertErr) throw insertErr;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Visit log error:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

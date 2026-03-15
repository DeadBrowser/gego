import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { licenseKey, deviceId } = req.body;
    if (!licenseKey || !deviceId) {
      return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    const { data: license } = await supabase
      .from('licenses')
      .select('id')
      .eq('key_string', licenseKey)
      .single();

    if (license) {
      await supabase
        .from('devices')
        .delete()
        .eq('license_id', license.id)
        .eq('device_id', deviceId);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

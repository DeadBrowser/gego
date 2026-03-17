import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from './auth';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let k = 'PROXY-';
  for (let i = 0; i < 4; i++) k += chars[Math.floor(Math.random() * chars.length)];
  k += '-';
  for (let i = 0; i < 4; i++) k += chars[Math.floor(Math.random() * chars.length)];
  return k;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const isValidAdmin = await verifyAdmin(req, supabase);
  if (!isValidAdmin) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      // Count only active devices (heartbeat in last 2 hours)
      const activeCutoff = new Date(Date.now() - 120 * 60 * 1000).toISOString();

      const { data: licenses } = await supabase
        .from('licenses')
        .select(`
          key_string, is_active, max_devices, expires_at, created_at,
          devices (id, last_heartbeat)
        `)
        .order('created_at', { ascending: false });

      const formatted = licenses.map(l => ({
        license: l.key_string,
        label: l.key_string.split('-')[1] || '',
        active: l.is_active,
        maxDevices: l.max_devices,
        deviceCount: l.devices ? l.devices.filter(d => d.last_heartbeat >= activeCutoff).length : 0,
        createdAt: l.created_at,
        expiresAt: l.expires_at
      }));

      return res.status(200).json({ keys: formatted });
    }

    if (req.method === 'POST') {
      // Create new key
      const { maxDevices = 3, durationDays } = req.body;
      const keyString = generateKey();
      
      let expiresAt = null;
      if (durationDays && durationDays > 0) {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(durationDays));
        expiresAt = d.toISOString();
      }

      const { data, error } = await supabase
        .from('licenses')
        .insert({
          key_string: keyString,
          max_devices: parseInt(maxDevices),
          expires_at: expiresAt
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, key: { license: data.key_string } });
    }

    if (req.method === 'DELETE') {
      // Delete key
      const { licenseKey } = req.body;
      await supabase.from('licenses').delete().eq('key_string', licenseKey);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from './auth';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const isValidAdmin = await verifyAdmin(req, supabase);
  if (!isValidAdmin) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // Force cleanup before getting counts
    const activeCutoff = new Date(Date.now() - 120 * 60 * 1000).toISOString();
    await supabase.from('devices').delete().lt('last_heartbeat', activeCutoff);

    const { data: keys, error } = await supabase.from('licenses').select('is_active, expires_at');
    if (error) throw error;

    const { count: devicesCount } = await supabase.from('devices').select('*', { count: 'exact', head: true });

    let active = 0;
    let expired = 0;
    const now = new Date();

    keys.forEach(k => {
      if (k.expires_at && new Date(k.expires_at) < now) expired++;
      else if (k.is_active) active++;
    });

    return res.status(200).json({
      totalKeys: keys.length,
      activeKeys: active,
      totalDevices: devicesCount || 0,
      expiredKeys: expired
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

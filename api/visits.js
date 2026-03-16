import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from './auth';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const isValidAdmin = await verifyAdmin(req, supabase);
  if (!isValidAdmin) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // Fetch logs with joined license info
    // In Supabase, we can use the foreign key relationship
    const { data: logs, error } = await supabase
      .from('visit_logs')
      .select(`
        id, device_id, domain, visited_at,
        licenses ( key_string )
      `)
      .order('visited_at', { ascending: false })
      .limit(100); // Last 100 logs

    if (error) throw error;

    const formatted = logs.map(l => ({
      id: l.id,
      device: l.device_id,
      domain: l.domain,
      time: l.visited_at,
      license: l.licenses ? l.licenses.key_string : 'Unknown',
      label: l.licenses ? (l.licenses.key_string.split('-')[1] || '') : ''
    }));

    return res.status(200).json({ logs: formatted });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

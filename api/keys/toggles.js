import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from './auth';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const isValidAdmin = await verifyAdmin(req, supabase);
  if (!isValidAdmin) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { licenseKey } = req.body;
    
    // Get current state
    const { data: license } = await supabase
      .from('licenses')
      .select('is_active')
      .eq('key_string', licenseKey)
      .single();
      
    if (!license) return res.status(404).json({ error: 'Key not found' });

    // Toggle
    await supabase
      .from('licenses')
      .update({ is_active: !license.is_active })
      .eq('key_string', licenseKey);

    return res.status(200).json({ success: true, active: !license.is_active });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

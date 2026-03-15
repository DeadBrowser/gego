export async function verifyAdmin(req, supabase) {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey) return false;

  const parts = adminKey.split(':');
  if (parts.length !== 2) return false;

  const [username, password] = parts;

  try {
    const { data: admin } = await supabase
      .from('admins')
      .select('id')
      .eq('username', username)
      .eq('password_hash', password) // In production, use bcrypt hash comparison
      .single();

    return !!admin;
  } catch (e) {
    return false;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Cached Supabase config for idestrim (avoids re-fetching JS bundle every time)
let cachedConfig: { url: string; key: string } | null = null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || (!url.includes('idestrim.site') && !url.includes('idestrim.com'))) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please provide a valid Idestrim link.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uuidMatch = url.match(/\/idea\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);

    if (!uuidMatch) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid link format. Expected: idestrim.site/idea/[id]' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const postId = uuidMatch[1];

    // Get Supabase config (cached or fresh)
    if (!cachedConfig) {
      cachedConfig = await getIdestrimSupabaseConfig();
    }

    if (!cachedConfig) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not connect to Idestrim. Please try again later.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query the media_uploads table directly
    const apiUrl = `${cachedConfig.url}/rest/v1/media_uploads?id=eq.${postId}&select=*`;
    const apiRes = await fetch(apiUrl, {
      headers: {
        'apikey': cachedConfig.key,
        'Authorization': `Bearer ${cachedConfig.key}`,
        'Accept': 'application/json',
      },
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('API error:', errText);
      // Clear cache in case config is stale
      cachedConfig = null;
      return new Response(
        JSON.stringify({ success: false, error: 'Could not fetch post from Idestrim.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rows = await apiRes.json();

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Post not found. Make sure the link is correct and the post is public.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const post = rows[0];

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          title: post.title || '',
          description: post.description || post.pitch_summary || '',
          image: post.media_url || post.thumbnail_url || '',
          tags: post.category ? [post.category] : [],
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to import.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getIdestrimSupabaseConfig(): Promise<{ url: string; key: string } | null> {
  try {
    const indexRes = await fetch('https://www.idestrim.site/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Idemark/1.0)' },
    });
    const html = await indexRes.text();

    // Find JS bundle
    const scriptMatch = html.match(/src="(\/assets\/[^"]+\.js)"/i);
    if (!scriptMatch) return null;

    const jsRes = await fetch(`https://www.idestrim.site${scriptMatch[1]}`);
    const js = await jsRes.text();

    const urlMatch = js.match(/https:\/\/[a-z]+\.supabase\.co/);
    const keyMatch = js.match(/eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);

    if (urlMatch && keyMatch) {
      return { url: urlMatch[0], key: keyMatch[0] };
    }
    return null;
  } catch {
    return null;
  }
}

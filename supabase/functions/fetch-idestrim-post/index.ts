const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    console.log('Fetching Idestrim URL:', url);

    // Fetch the page HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Idemark/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch the Idestrim post (status ${response.status}).` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();

    // Extract Open Graph / meta tags
    const ogTitle = extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title');
    const ogDescription = extractMeta(html, 'og:description') || extractMeta(html, 'twitter:description') || extractMeta(html, 'description');
    const ogImage = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image');

    // Also try to extract from the HTML body content (for SPAs that render inline)
    const bodyTitle = extractFromHtml(html, /<h1[^>]*>(.*?)<\/h1>/i) ||
                      extractFromHtml(html, /<h2[^>]*>(.*?)<\/h2>/i) ||
                      extractFromHtml(html, /<h3[^>]*>(.*?)<\/h3>/i);
    
    const bodyDescription = extractFromHtml(html, /<p[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/p>/i) ||
                            extractFromHtml(html, /<p[^>]*>(.*?)<\/p>/i);

    // Extract image from body - look for Supabase storage URLs (common for idestrim)
    const supabaseImageMatch = html.match(/https:\/\/[a-z]+\.supabase\.co\/storage\/v1\/object\/public\/media\/[^\s"'<>]+/i);
    const bodyImage = supabaseImageMatch ? supabaseImageMatch[0] : null;

    // Extract any tags/categories from the page
    const tagsMatch = html.match(/(?:category|tag|topic)[^>]*>([^<]+)</gi);
    const tags: string[] = [];
    if (tagsMatch) {
      for (const match of tagsMatch) {
        const tagText = match.replace(/<[^>]+>/g, '').trim();
        if (tagText && tagText.length < 50) {
          tags.push(tagText);
        }
      }
    }

    const title = ogTitle || bodyTitle || '';
    const description = ogDescription || bodyDescription || '';
    const image = ogImage || bodyImage || '';

    if (!title && !description && !image) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not extract post data from this link. Make sure it\'s a valid shared post URL from Idestrim.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted:', { title, description: description?.substring(0, 50), image: image?.substring(0, 50), tags });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          title: cleanHtml(title),
          description: cleanHtml(description),
          image,
          tags,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching Idestrim post:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to import post.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractMeta(html: string, property: string): string | null {
  // Try property attribute
  const propMatch = html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'));
  if (propMatch) return propMatch[1];
  
  // Try name attribute
  const nameMatch = html.match(new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'));
  if (nameMatch) return nameMatch[1];

  // Try reversed order (content before property)
  const revMatch = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i'));
  if (revMatch) return revMatch[1];

  return null;
}

function extractFromHtml(html: string, regex: RegExp): string | null {
  const match = html.match(regex);
  if (match && match[1]) {
    return cleanHtml(match[1]);
  }
  return null;
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

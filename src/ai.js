export async function enrichWithAI(title, stylePrompt, lyrics, apiKey) {
  const lyricsSnip = (lyrics||'').slice(0,1500);
  const prompt = [
    'You are filling in missing metadata for a song in a music catalog.',
    'Based on the title, style prompt, and lyrics, return values for all fields.',
    '',
    'Song Title: ' + title,
    'Style Prompt: ' + stylePrompt,
    'Lyrics (first 1500 chars): ' + lyricsSnip,
    '',
    'Return ONLY this JSON, no markdown, no preamble:',
    '{',
    '  "genre": "primary genre label (e.g. Gospel, Country Folk, Hip Hop, Cinematic Pop)",',
    '  "mood": "one from: Hopeful, Mournful, Triumphant, Contemplative, Urgent, Joyful, Raw, Tender, Epic, Defiant",',
    '  "instrumentalMood": "one from: Sparse, Orchestral, Driving, Ambient, Acoustic, Electronic, Big Band, Stripped, Choir-led, Rhythm-heavy, Cinematic",',
    '  "targetAudience": "one from: General, Young Adults, Elderly Listeners, Congregation, Seekers, Families, Men, Women, Youth",',
    '  "duration": "one from: Short (under 2 min), Standard (2-4 min), Extended (4+ min)",',
    '  "themes": ["2-4 thematic tags e.g. Faith, Hope, Redemption, Journey, Love, Justice, Identity, Loss, Celebration, Doubt, Community"],',
    '  "versionSummary": "2-sentence catalog description of this song\'s sound and message",',
    '  "albumNote": "1 sentence on where this fits in a setlist or album"',
    '}'
  ].join('\n');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
    body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:600, messages:[{ role:'user', content:prompt }] })
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message || 'API error');
  const text = d.content?.find(b=>b.type==='text')?.text || '{}';
  return JSON.parse(text.replace(/```json\n?|```/g,'').trim());
}

export async function analyzeWithAI(title, stylePrompt, lyrics, apiKey, personas, bulkMode) {
  const personaList = personas.map(p=>'- ' + p.id + ' | ' + p.name + ' | Genre: ' + p.genre + ' | ' + p.desc).join('\n');
  const lyricsSnip = (lyrics||'').slice(0,2000);
  const bulkPrompt = 'You are assigning a song to the best matching persona from a fixed list. You MUST pick one from the list. Do not suggest new personas.\n\nSong Title: ' + title + '\nStyle Prompt: ' + stylePrompt + '\nLyrics (first 2000 chars): ' + lyricsSnip + '\n\nAvailable personas (pick the single best match):\n' + personaList + '\n\nReturn ONLY this JSON, no markdown:\n{\n  "persona": "the id of the best matching persona",\n  "genre": "primary genre label",\n  "themes": ["2-4 theme tags"],\n  "mood": "one word mood",\n  "instrumentalMood": "one instrumental mood",\n  "targetAudience": "one audience",\n  "versionSummary": "2-sentence catalog description"\n}';
  const fullPrompt = 'Analyze this song and return ONLY valid JSON, no markdown, no preamble.\n\nSong Title: ' + title + '\nStyle Prompt: ' + stylePrompt + '\nLyrics (first 2000 chars): ' + lyricsSnip + '\n\nPersonas available:\n' + personaList + '\n\nINSTRUCTIONS:\n1. If the song fits an existing persona reasonably well, set suggestedPersona to that persona\'s id and set suggestNewPersona to false.\n2. If the song\'s genre clearly does not match any existing persona (e.g. a reggae song when no reggae persona exists), set suggestNewPersona to true, set suggestedPersona to "unassigned", and fill in all three suggestedNewPersona fields: a short artist-style name, a genre label, and a 1-sentence description of the persona\'s sound and vibe. Only suggest a new persona when the genre mismatch is clear and meaningful — not for minor stylistic differences.\n\nReturn exactly this JSON:\n{\n  "suggestedPersona": "one persona id from the list above if it fits, otherwise unassigned",\n  "personaReason": "1-2 sentence explanation",\n  "suggestNewPersona": false,\n  "suggestedNewPersonaName": "short artist-style name for the new persona, or null",\n  "suggestedNewPersonaGenre": "genre label for the new persona, or null",\n  "suggestedNewPersonaDesc": "1-sentence description of the persona\'s sound and vibe, or null",\n  "genre": "primary genre label",\n  "themes": ["2-4 theme tags"],\n  "mood": "one word: Hopeful, Mournful, Triumphant, Contemplative, Urgent, Joyful, Raw, Tender, Epic, Defiant",\n  "instrumentalMood": "one from: Sparse, Orchestral, Driving, Ambient, Acoustic, Electronic, Big Band, Stripped, Choir-led, Rhythm-heavy, Cinematic",\n  "targetAudience": "one from: General, Young Adults, Elderly Listeners, Congregation, Seekers, Families, Men, Women, Youth",\n  "duration": "one from: Short (under 2 min), Standard (2-4 min), Extended (4+ min)",\n  "versionSummary": "2-sentence catalog description",\n  "albumNote": "1 sentence on where this fits in a setlist or album"\n}';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
    body: JSON.stringify({
      model:'claude-sonnet-4-6', max_tokens: bulkMode ? 600 : 1000,
      messages:[{ role:'user', content: bulkMode ? bulkPrompt : fullPrompt }]
    })
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message || 'API error');
  const text = d.content?.find(b=>b.type==='text')?.text || '{}';
  const parsed = JSON.parse(text.replace(/```json\n?|```/g,'').trim());
  if (bulkMode && parsed.persona && !parsed.suggestedPersona) parsed.suggestedPersona = parsed.persona;
  return parsed;
}

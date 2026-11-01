// Sets up the Backbone Discord server through a bot. Safe to re-run: channels
// and roles are matched by name and updated, never duplicated.
// Usage: node --env-file=.env.local scripts/discord-setup.mjs
import { readFileSync } from 'node:fs';

const API = 'https://discord.com/api/v10';
const GAME_URL = 'https://thiritin.github.io/backbone/';
const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('DISCORD_TOKEN missing');

async function api(method, path, body) {
  for (;;) {
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    if (res.status === 429) {
      const { retry_after } = await res.json();
      await new Promise((r) => setTimeout(r, retry_after * 1000 + 100));
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }
}

const TEXT = 0, VOICE = 2, CATEGORY = 4, NEWS = 5, FORUM = 15;
const VIEW_CHANNEL = 1n << 10n;
const SEND_MESSAGES = 1n << 11n;
const CREATE_THREADS = 1n << 35n;

const ROLES = [
  { name: 'Dev', color: 0x3b63e8, hoist: true },
  { name: 'Tester', color: 0x2fbf71, hoist: true },
];

const status = [
  { name: 'Planned', emoji_name: '📌' },
  { name: 'In progress', emoji_name: '🔧' },
  { name: 'Done', emoji_name: '✅' },
  { name: 'Declined', emoji_name: '⛔', moderated: true },
];

// `rename` adopts the default categories Discord creates with a new server.
// `access`: 'readOnly' lets only Dev post, 'staff' hides the channel from everyone but Dev.
const LAYOUT = [
  { name: 'Info', channels: [
    { name: 'welcome', topic: 'Read this first to learn what Backbone is and where to play it.', access: 'readOnly' },
    { name: 'announcements', type: NEWS, topic: 'New releases and news about the game are posted here.', access: 'readOnly' },
    { name: 'changelog', type: NEWS, topic: 'Every update to the game is listed here.', access: 'readOnly' },
  ] },
  { name: 'Community', rename: 'Text channels', channels: [
    { name: 'general', topic: 'Talk about Backbone and anything around it.' },
    { name: 'screenshots', topic: 'Show off your racks, your datacenter and your best runs.' },
    { name: 'off-topic', topic: 'Talk about anything that is not the game.' },
  ] },
  { name: 'Game', channels: [
    { name: 'feature-requests', type: FORUM,
      topic: 'Open one post per idea with a clear title, and upvote ideas you want with a reaction. Search first so votes land on one post.',
      tags: [
        { name: 'Hardware', emoji_name: '🖥️' },
        { name: 'Network', emoji_name: '🌐' },
        { name: 'Economy', emoji_name: '💰' },
        { name: 'Customers', emoji_name: '👥' },
        { name: 'UI', emoji_name: '🪟' },
        ...status,
      ] },
    { name: 'bug-reports', type: FORUM,
      topic: 'Open one post per bug. Describe what you did, what happened and what you expected, and attach a screenshot if you can.',
      tags: [
        { name: 'Crash', emoji_name: '💥' },
        { name: 'Save', emoji_name: '💾' },
        { name: 'Balance', emoji_name: '⚖️' },
        { name: 'UI', emoji_name: '🪟' },
        ...status,
      ] },
    { name: 'feedback', topic: 'Tell us what feels good and what feels off while playing.' },
  ] },
  { name: 'Voice', rename: 'Voice channels', channels: [
    { name: 'General', type: VOICE },
  ] },
  { name: 'Staff', access: 'staff', channels: [
    { name: 'mod-log', topic: 'Discord sends community updates and moderation notices here.', access: 'staff' },
  ] },
];

const WELCOME = `# Welcome to Backbone

Backbone is a browser management game where you grow a hosting company from a basement in 2005 to your own datacenter. Buy hardware, rack it, wire the network and keep your customers online.

**Play now:** ${GAME_URL}

## Where to go
- <#announcements> has news and releases.
- <#changelog> lists every update to the game.
- <#feature-requests> is where you post ideas and vote on them with a reaction.
- <#bug-reports> is where you report bugs, one post per bug.
- <#general> is for everything else.

## Rules
1. Be kind to each other.
2. Keep each channel on its topic.
3. Do not spam or advertise.
4. Do not post anything illegal or NSFW.`;

const guilds = await api('GET', '/users/@me/guilds');
const g = guilds.find((x) => x.name === 'Backbone') ?? guilds[0];
if (!g) throw new Error('Bot is in no server; invite it first');
let guild = await api('GET', `/guilds/${g.id}`);
const me = await api('GET', '/users/@me');
console.log(`Server: ${guild.name} (${guild.id})`);

const icon = readFileSync(new URL('../docs/brand/logo-512.png', import.meta.url)).toString('base64');
guild = await api('PATCH', `/guilds/${guild.id}`, { icon: `data:image/png;base64,${icon}` });
if (!me.avatar) await api('PATCH', '/users/@me', { avatar: `data:image/png;base64,${icon}` });
console.log('Icon set');

const roles = await api('GET', `/guilds/${guild.id}/roles`);
const roleIds = {};
for (const r of ROLES) {
  const found = roles.find((x) => x.name === r.name);
  const role = found
    ? await api('PATCH', `/guilds/${guild.id}/roles/${found.id}`, r)
    : await api('POST', `/guilds/${guild.id}/roles`, r);
  roleIds[r.name] = role.id;
  console.log(`Role ${r.name}`);
}
await api('PUT', `/guilds/${guild.id}/members/${guild.owner_id}/roles/${roleIds.Dev}`);

// @everyone shares the guild id.
const overwrites = {
  readOnly: [
    { id: guild.id, type: 0, allow: '0', deny: String(SEND_MESSAGES | CREATE_THREADS) },
    { id: roleIds.Dev, type: 0, allow: String(SEND_MESSAGES), deny: '0' },
  ],
  staff: [
    { id: guild.id, type: 0, allow: '0', deny: String(VIEW_CHANNEL) },
    { id: roleIds.Dev, type: 0, allow: String(VIEW_CHANNEL), deny: '0' },
    { id: me.id, type: 1, allow: String(VIEW_CHANNEL | SEND_MESSAGES), deny: '0' },
  ],
};

let channels = await api('GET', `/guilds/${guild.id}/channels`);
const find = (name, type) => channels.find((c) => c.type === type && c.name.toLowerCase() === name.toLowerCase());

async function ensure(spec, extra = {}) {
  const type = spec.type ?? TEXT;
  const body = { name: spec.name, ...extra };
  if (spec.topic && type !== VOICE) body.topic = spec.topic;
  if (spec.access) body.permission_overwrites = overwrites[spec.access];
  if (spec.tags) body.available_tags = spec.tags;
  if (type === FORUM) body.default_reaction_emoji = { emoji_name: '👍' };
  // A plain text channel becomes an announcement channel once Community is on.
  const found = find(spec.name, type) ?? (type === NEWS && find(spec.name, TEXT));
  const ch = found
    ? await api('PATCH', `/channels/${found.id}`, { ...body, type })
    : await api('POST', `/guilds/${guild.id}/channels`, { ...body, type });
  channels = channels.filter((c) => c.id !== ch.id).concat(ch);
  return ch;
}

// Community needs a rules and an updates channel before forums and announcement channels exist.
if (!guild.features.includes('COMMUNITY')) {
  const rules = await ensure(LAYOUT[0].channels[0]);
  const modLog = await ensure(LAYOUT[4].channels[0]);
  await api('PATCH', `/guilds/${guild.id}`, {
    features: [...guild.features, 'COMMUNITY'],
    verification_level: 1,
    explicit_content_filter: 2,
    rules_channel_id: rules.id,
    public_updates_channel_id: modLog.id,
  });
  console.log('Community enabled');
}

for (const [position, cat] of LAYOUT.entries()) {
  const existing = find(cat.name, CATEGORY) ?? (cat.rename && find(cat.rename, CATEGORY));
  const catSpec = { ...cat, type: CATEGORY, topic: undefined, tags: undefined };
  if (existing) existing.name = cat.name;
  const parent = await ensure(catSpec, { position });
  console.log(`Category ${cat.name}`);
  for (const [i, ch] of cat.channels.entries()) {
    await ensure(ch, { parent_id: parent.id, position: i });
    console.log(`  #${ch.name}`);
  }
}

const mention = Object.fromEntries(channels.map((c) => [c.name, `<#${c.id}>`]));
const link = (text) => text.replace(/<#([a-z-]+)>/g, (m, name) => mention[name] ?? `#${name}`);
const welcomeText = link(WELCOME);
const welcome = find('welcome', TEXT);
const posted = (await api('GET', `/channels/${welcome.id}/messages?limit=20`)).find((m) => m.author.id === me.id);
if (posted) await api('PATCH', `/channels/${welcome.id}/messages/${posted.id}`, { content: welcomeText });
else await api('POST', `/channels/${welcome.id}/messages`, { content: welcomeText });
console.log('Welcome message posted');

// Pinned, locked "Start here" post at the top of each forum.
const START_HERE = {
  'feature-requests': { name: 'Start here: how to request a feature', content: `# Start here: how to request a feature

This forum collects ideas for Backbone, one post per idea. Search before you post. If your idea is already here, react with 👍 on that post instead of opening a new one, so the votes land in one place.

## How to write a good request
- Give the post a title that names the idea, like "Let me rename racks" instead of "Suggestion".
- Pick a tag: Hardware, Network, Economy, Customers or UI.
- Describe the problem you ran into while playing before you describe your solution. There is often a simpler fix than the one you have in mind.
- Say where in the game you were: the year, the app or the screen.
- Keep it to one idea. If you have three, open three posts.

## Template
\`\`\`
What I want to do:
Why I cannot do it right now:
How I imagine it working:
Where in the game:
\`\`\`

## What happens next
A dev adds a status tag: 📌 Planned, 🔧 In progress, ✅ Done or ⛔ Declined. Declined posts get a short reply that says why. Shipped features show up in <#changelog>.` },
  'bug-reports': { name: 'Start here: how to report a bug', content: `# Start here: how to report a bug

One post per bug. Search first. If someone already reported it, reply in that post with your details instead of opening a new one.

## What to include
- A title that says what went wrong, like "Server stays offline after moving it to another rack" instead of "Bug".
- The steps you took, in order, so we can repeat them.
- What happened, and what you expected to happen instead.
- Where you were in the game: the year and the app or window.
- Your browser and device, like Chrome on Windows or Safari on iPhone.
- A screenshot or a short recording, attached to the post.
- For save problems, attach your save. The Backbone menu has "Export save…".

If you prefer GitHub, "Report an issue" in the Backbone menu opens an issue with the build id filled in.

## Tags
💥 Crash when the game freezes or shows an error. 💾 Save when progress is lost or a save will not load. ⚖️ Balance when a number or price feels wrong. 🪟 UI when something looks wrong or is hard to use.

## Template
\`\`\`
What I did:
What happened:
What I expected:
Where in the game:
Browser and device:
\`\`\`

A dev tags the post 📌 Planned, 🔧 In progress or ✅ Done once the fix ships, and the fix appears in <#changelog>.` },
};

const PINNED = 1 << 1;
const active = (await api('GET', `/guilds/${guild.id}/threads/active`)).threads;
for (const [channel, post] of Object.entries(START_HERE)) {
  const forum = find(channel, FORUM);
  const content = link(post.content);
  const existing = active.find((th) => th.parent_id === forum.id && th.owner_id === me.id && th.name === post.name);
  if (existing) {
    // A forum post's first message shares the thread id.
    await api('PATCH', `/channels/${existing.id}/messages/${existing.id}`, { content });
  } else {
    const th = await api('POST', `/channels/${forum.id}/threads`, { name: post.name, auto_archive_duration: 10080, message: { content } });
    await api('PATCH', `/channels/${th.id}`, { flags: PINNED, locked: true });
  }
  console.log(`  Start here in #${channel}`);
}

await api('PATCH', `/guilds/${guild.id}`, {
  system_channel_id: find('general', TEXT).id,
  description: 'Grow a hosting company from a 2005 basement to your own datacenter.',
});

const invite = await api('POST', `/channels/${welcome.id}/invites`, { max_age: 0, max_uses: 0, unique: false });
console.log(`Invite: https://discord.gg/${invite.code}`);

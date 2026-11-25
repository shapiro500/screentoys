const introsPart1 = [
    "oh, hello there.",
    "greetings.",
    "welcome.",
    "well, well, well.",
    "nice to see you.",
    "ah, it's you.",
    "hello again.",
    "well hello.",
    "oh. hi.",
    "look who it is.",
    "hi there.",
    "welcome back.",
    "good to have you.",
    "ah. yes. hi.",
    "hey now."
];

const introsPart2 = [
    "perhaps you would enjoy some",
    "please help yourself to some",
    "looks like someone's eager for",
    "why not try out a few",
    "feast your eyes on these",
    "you might like this collection of",
    "feel free to poke at some",
    "maybe take a moment with these",
    "care to sample some",
    "have a look at these",
    "we've prepared a set of",
    "there's always room for some",
    "you've stumbled upon some",
    "this may be a good time for some",
    "go ahead and explore some",
    "we can just look at some",
    "we'll call these",
    "here's what we're calling",
    "nothing fancy, just some",
    "you may be interested in",
    "anyway. behold, some",
    "just for you, we've set aside some"
];

const toys = [
    {
        title: "Spooky Bones",
        launchMonth: "2026-07",
        description: "A spooky skeleton dance extravaganza. Throw on some music and enjoy the bones.",
        videoSrc: "assets/bones.mp4",
        url: "/bones/"
    },
    {
        title: "Firewood Splitting Simulator",
        launchMonth: "2026-06",
        description: "Come see what it's like to split wood in my yard on my actual stump with my actual axe.",
        videoSrc: "assets/firewood.mp4",
        url: "/firewood/"
    },
    {
        title: "Splitshift",
        launchMonth: "2026-02",
        description: "A simple sliding tile puzzle that is definitely too hard for me.",
        videoSrc: "assets/splitshift.mp4",
        url: "/splitshift/"
    },
    {
        title: "Chess 2",
        launchMonth: "2026-01",
        description: "At last, Chess can finally be played the way we've always wanted: by haphazardly chucking a bunch of pieces at each other.",
        videoSrc: "assets/chess2.mp4",
        url: "/chess2/"
    },
    {
        title: "Road trip",
        launchMonth: "2026-01",
        description: "Send torrents of cars smashing down into a field of cows. Don't worry, you can't hit the cows.",
        videoSrc: "assets/roadtrip.mp4",
        url: "/roadtrip/"
    },
    {
        title: "Poms",
        launchMonth: "2025-12",
        description: "Summon explosive pomeranians running at full speed by tapping or typing. Pairs nicely with heavy metal.",
        videoSrc: "assets/poms.mp4",
        url: "/poms/"
    },
    {
        title: "Five Penguins",
        launchMonth: "2022-03",
        description: "Majestic penguin visualizer that you can sync to music.",
        videoSrc: "assets/5p.mp4",
        url: "https://fivepenguins.party",
        desktopOnly: true
    },
    {
        title: "shapiro500",
        launchMonth: "2019-08",
        description: "Need some background visuals for a party? This VJ tool displays dozens of playful 3D animations forever. Change the tempo, sync to music.",
        videoSrc: "assets/shapiro500.mp4",
        url: "https://shapiro500.com",
        desktopOnly: true
    }
];


const root = document.documentElement;
const themeButton = document.querySelector('.theme-toggle');
let savedTheme;
try { savedTheme = localStorage.getItem('screen-toys-theme'); } catch (_) {}
const setTheme = theme => {
  root.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  themeButton.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
  themeButton.title = root.dataset.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  try { localStorage.setItem('screen-toys-theme', root.dataset.theme); } catch (_) {}
};
setTheme(savedTheme || 'light');
themeButton.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));

const pick = array => array[Math.floor(Math.random() * array.length)];
const greeting = `${pick(introsPart1)} ${pick(introsPart2)}`;
const introCopy = document.getElementById('intro-copy');
const firstPart = introsPart1.find(part => greeting.startsWith(part + ' '));
if (firstPart && introsPart2.includes(greeting.slice(firstPart.length + 1))) {
  const fragments = [firstPart, greeting.slice(firstPart.length + 1)].map(copy => {
    const span = document.createElement('span');
    span.className = 'intro-part';
    span.textContent = copy;
    return span;
  });
  introCopy.replaceChildren(fragments[0], ' ', fragments[1]);
} else introCopy.textContent = greeting;

const grid = document.getElementById('toy-grid');
// Native same-tab navigation preserves browser Back/Forward behavior.
const launchDateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short', year: 'numeric', timeZone: 'UTC'
});
toys.forEach(toy => {
  const link = document.createElement('a');
  link.className = `toy-item${toy.desktopOnly ? ' is-desktop-only' : ''}`;
  link.href = toy.url;
  const media = document.createElement('div');
  media.className = 'video-container';
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  video.poster = toy.videoSrc.replace('.mp4', '.jpg');
  video.setAttribute('aria-hidden', 'true');
  video.src = toy.videoSrc;
  video.textContent = 'Your browser does not support the video tag.';
  media.append(video);
  const info = document.createElement('div');
  info.className = 'toy-info';
  const title = document.createElement('h2');
  title.className = 'toy-title';
  title.textContent = toy.title;
  const titleRow = document.createElement('div');
  titleRow.className = 'toy-title-row';
  titleRow.append(title);
  if (toy.launchMonth) {
    const date = document.createElement('time');
    date.className = 'toy-date';
    date.dateTime = toy.launchMonth;
    date.textContent = launchDateFormat.format(new Date(toy.launchMonth + '-01T00:00:00Z'));
    date.setAttribute('aria-label', 'Launched ' + date.textContent);
    titleRow.append(date);
  }
  const description = document.createElement('p');
  description.className = 'toy-description';
  description.textContent = toy.description;
  info.append(titleRow, description);
  if (toy.desktopOnly) {
    const warning = document.createElement('p');
    warning.className = 'desktop-only-warning';
    warning.append('WARNING:', document.createElement('br'), "Doesn't really work on a phone");
    info.append(warning);
  }
  const content = document.createElement('div');
  content.className = 'toy-content';
  content.append(media, info);
  link.append(content);
  grid.append(link);
});

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const visibleVideos = new Set();
const updatePlayback = () => {
  document.querySelectorAll('video').forEach(video => {
    if (!document.hidden && !reducedMotion.matches && visibleVideos.has(video)) video.play().catch(() => {});
    else video.pause();
  });
};
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) visibleVideos.add(entry.target);
    else visibleVideos.delete(entry.target);
  });
  updatePlayback();
}, { threshold: 0.05 });
document.querySelectorAll('video').forEach(video => observer.observe(video));
document.addEventListener('visibilitychange', updatePlayback);
reducedMotion.addEventListener('change', updatePlayback);

const flamingo = document.querySelector('.flamingo-squad');
const updateFlamingo = () => { flamingo.src = reducedMotion.matches ? 'assets/flamingo-still.png' : 'assets/flamingoSquad.webp'; };
reducedMotion.addEventListener('change', updateFlamingo);
updateFlamingo();

if (root.dataset.layout === 'compact-grid') grid.append(document.querySelector('.footer'));

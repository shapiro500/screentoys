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
    "thanks for stopping by.",
    "look who it is.",
    "hi there.",
    "welcome back.",
    "good to have you.",
    "ah. yes. hi.",
    "thanks for your interest.",
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
        title: "Road trip",
        description: "Send torrents of cars smashing down into a field of cows. Don't worry, you can't hit the cows.",
        videoSrc: "assets/roadtrip.mp4",
        url: "/roadtrip/index.html"
    },
    {
        title: "Poms",
        description: "Summon explosive pomeranians running at full speed by tapping or typing. Pairs nicely with heavy metal.",
        videoSrc: "assets/poms.mp4",
        url: "https://poms.fun"
    },
    {
        title: "Five Penguins",
        description: "Majestic penguin visualizer that you can sync to music.",
        videoSrc: "assets/5p.mp4",
        url: "https://fivepenguins.party",
        desktopOnly: true
    },
    {
        title: "shapiro500",
        description: "In-browser VJ tool for displaying dozens of playful 3D animated loops. Change the tempo, sync to music.",
        videoSrc: "assets/shapiro500.mp4",
        url: "https://shapiro500.com",
        desktopOnly: true
    }
];

function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function adjustTextScaling() {
    const logo = document.querySelector('.logo');
    const introEl = document.getElementById('intro-copy');

    // Get max sizes from CSS variables
    const style = getComputedStyle(document.documentElement);
    const maxLogoSize = parseFloat(style.getPropertyValue('--logo-size'));
    const maxIntroSize = parseFloat(style.getPropertyValue('--intro-size'));

    function fit(el, maxSize) {
        if (!el) return;
        el.style.fontSize = maxSize + 'px';
        el.style.whiteSpace = 'nowrap';
        el.style.display = 'block';
        el.style.width = 'max-content';
        el.style.margin = '0 auto';

        const parentWidth = document.querySelector('.header').clientWidth;
        const currentWidth = el.offsetWidth;

        if (currentWidth > parentWidth) {
            const ratio = (parentWidth - 4) / currentWidth; // 4px buffer
            el.style.fontSize = (maxSize * ratio) + 'px';
        }
    }

    fit(logo, maxLogoSize);
    fit(introEl, maxIntroSize);
}

function init() {
    // Set intro copy
    const introEl = document.getElementById('intro-copy');
    const part1 = getRandomItem(introsPart1);
    const part2 = getRandomItem(introsPart2);
    introEl.textContent = `${part1} ${part2}`;

    // Adjust text scaling immediately after setting content
    adjustTextScaling();

    // Populate grid
    const gridEl = document.getElementById('toy-grid');
    toys.forEach(toy => {
        const item = document.createElement('a');
        item.className = 'toy-item';
        if (toy.desktopOnly) {
            item.classList.add('is-desktop-only');
        }
        item.href = toy.url;
        item.target = '_blank';

        item.innerHTML = `
            <div class="video-container">
                <video autoplay loop muted playsinline>
                    <source src="${toy.videoSrc}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
                ${toy.desktopOnly ? '<div class="desktop-only-warning">WARNING:<br>Doesn\'t really work on a phone</div>' : ''}
            </div>
            <div class="toy-info">
                <h3 class="toy-title">${toy.title}</h3>
                <p class="toy-description">${toy.description}</p>
            </div>
        `;

        gridEl.appendChild(item);
    });
}

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('resize', adjustTextScaling);

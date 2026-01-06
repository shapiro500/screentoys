const introsPart1 = [
    "oh, hello there.",
    "greetings.",
    "welcome.",
    "well, well, well."
];

const introsPart2 = [
    "perhaps you would enjoy some",
    "please help yourself to some",
    "looks like someone's eager for",
    "why not try out a few"
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
        url: "https://fivepenguins.party"
    },
    {
        title: "shapiro500",
        description: "In-browser VJ tool for displaying dozens of playful 3D animated loops. Change the tempo, sync to music.",
        videoSrc: "assets/shapiro500.mp4",
        url: "https://shapiro500.com"
    }
];

function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function init() {
    // Set intro copy
    const introEl = document.getElementById('intro-copy');
    const part1 = getRandomItem(introsPart1);
    const part2 = getRandomItem(introsPart2);
    introEl.textContent = `${part1} ${part2}`;

    // Populate grid
    const gridEl = document.getElementById('toy-grid');
    toys.forEach(toy => {
        const item = document.createElement('a');
        item.className = 'toy-item';
        item.href = toy.url;
        item.target = '_blank';

        item.innerHTML = `
            <div class="video-container">
                <video autoplay loop muted playsinline>
                    <source src="${toy.videoSrc}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            </div>
            <div class="toy-info">
                <h2 class="toy-title">${toy.title}</h2>
                <p class="toy-description">${toy.description}</p>
            </div>
        `;

        gridEl.appendChild(item);
    });
}

document.addEventListener('DOMContentLoaded', init);

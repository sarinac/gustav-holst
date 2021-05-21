//////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////// SETUP //////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////

const scroll = d3.select("#scroll");
const scrollText = scroll.select(".scroll-text");
const scrollTextStep = scrollText.selectAll(".step");
const scrollTextTable = scrollText.selectAll(".table");
const scrollGraphic = scroll.select(".scroll-graphic");
const scrollGraphicPlanet = scrollGraphic.select("#planet");
const background = d3.select("html");

const scroller = scrollama();
let planet;

/**
 * Load data and draw graphic
 */
init = () => {
    handleResize();
    window.addEventListener("resize", handleResize);
    Promise.all([
        d3.json("data/data.json"),
        d3.json("data/pitchClasses.json"),
        d3.json("data/colors.json"),
    ])
        .then((data) => {
            planet = new Planet(data[0], data[1], data[2], scrollGraphicPlanet);
        })
        .then(() => {
            scroller
                .setup({
                    scroll: "#scroll",
                    scrollGraphic: ".scroll-graphic",
                    scrollText: ".scroll-text",
                    step: ".step",
                    progress: true,
                    offset: 0.2,
                    // debug: true,
                })
                .onStepEnter(handleStepEnter)
                .onStepExit(handleStepExit);
        })
        .catch((error) => {
            console.error("Error loading data");
            throw error;
        });
};

handleResize = () => {
    const ratio = 0.8;
    // Update graphic measurements
    scrollGraphic
        .style("height", `${ratio * window.innerHeight}px`)
        .style("top", `${window.innerHeight * 0.5 * (1 - ratio)}px`);
    background.style("height", `${window.innerHeight}px`);

    // Update height of step elements for breathing room between steps
    scrollTextTable
        .style("min-height", `${ratio * window.innerHeight}px`)
        .style("margin-left", `${0.1 * window.innerHeight}px`)
        .style("margin-right", `${0.1 * window.innerHeight}px`);

    // Update new element dimensions in scrollama
    scroller.resize();
};

handleStepEnter = (response) => {
    planet.setPlanet(response.index, response.direction);
    planet.renderPlanet();
};

handleStepExit = (response) => {
    if (response.index === 0 && response.direction === "up") {
        planet.clear();
    }
};

init();

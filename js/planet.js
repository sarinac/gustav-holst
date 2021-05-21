class Planet {
    constructor(planets, pitchClasses, colors, container) {
        // Datasets
        this.planets = planets;
        this.pitchClasses = pitchClasses;
        this.colors = colors;
        this.planets[-1] = {
            planet: "",
            description: "",
            duration: 0,
            key: 0,
            analysis: {
                sections: [],
                bars: [],
                beats: [],
                tatums: [],
                segments: [],
            },
        };
        this.planet = this.planets[-1];
        this.isStart = true;

        // Canvas
        this.resolution = 3;
        const dimension =
            container.node().getBoundingClientRect().height * this.resolution;
        this.canvas = container
            .append("canvas")
            .attr("width", dimension)
            .attr("height", dimension);
        this.context = this.canvas.node().getContext("2d");
        this.context.translate(dimension / 2, dimension / 2);

        // Animation
        this.duration = 1400;

        // Constants
        this.constants = {
            startAngle: Math.PI / 36,
            endAngle: 2 * Math.PI - Math.PI / 36,
            anglePadding: Math.PI / 576,
        };
        this.layers = {
            gridStart: (0.23 * dimension) / 2,
            gridEnd: (0.6 * dimension) / 2,
            tatumsStart: (0.63 * dimension) / 2,
            tatumsEnd: (0.64 * dimension) / 2,
            beatsStart: (0.655 * dimension) / 2,
            beatsEnd: (0.665 * dimension) / 2,
            barsStart: (0.675 * dimension) / 2,
            barsEnd: (0.69 * dimension) / 2,
            sectionsStart: (0.7 * dimension) / 2,
            sectionsEnd: (0.73 * dimension) / 2,
            loudnessStart: (0.78 * dimension) / 2,
            loudnessEnd: (0.9 * dimension) / 2,
            minutesEnd: (0.92 * dimension) / 2,
            whole: dimension / 2,
        };
        this.fonts = {
            legend: this.layers.gridStart / 10,
            title: this.layers.gridStart / 3,
            description: this.layers.gridStart / 8,
        };

        this.setUpSVG();
    }

    setUpSVG() {
        // Hidden containers
        this.custom = document.createElement("custom");
        this.container = d3.select(this.custom);

        // Loudness
        this.loudnessSections = this.container.append("g");
        for (let i = 5; i >= 0; i--) {
            this[`loudnessSections-${i}`] = this.loudnessSections
                .append("path")
                .attr("id", `loudness-${i}`);
        }

        // Grid
        this.grid = this.container.append("g").attr("id", "grid");
        this.gridLegend = this.grid
            .append("g")
            .selectAll("text")
            .data(["sections", "bars", "beats", "tatums"])
            .join("text")
            .text((d) => d)
            .attr("x", 0)
            .attr(
                "y",
                (d) =>
                    -(
                        this.layers[`${d}Start`] +
                        0.5 *
                            (this.layers[`${d}End`] - this.layers[`${d}Start`])
                    )
            );
        this.gridNotation = this.grid
            .append("g")
            .selectAll("text")
            .data(this.pitchClasses, (d) => d)
            .join("text")
            .attr("x", 0)
            .attr("y", -this.layers.gridEnd)
            .text(
                (d) =>
                    d[
                        `pitchClass${
                            [0, 7, 2, 9, 4, 11].includes(d.integerNotation)
                                ? "Sharp"
                                : "Flat"
                        }`
                    ]
            );
        this.gridLines = this.grid
            .append("g")
            .selectAll("path")
            .data(this.pitchClasses, (d) => d.integerNotation)
            .join("path");

        // Rhythm
        this.rhythm = this.container.append("g");
        this.rhythmSectionsG = this.rhythm.append("g");
        this.rhythmBarsG = this.rhythm.append("g");
        this.rhythmMinutesG = this.rhythm.append("g");
        this.rhythmMinutesTextG = this.rhythm.append("g");

        // Pitches
        this.segments = this.container.append("g");
        d3.range(this.pitchClasses.length).forEach((index) => {
            this[`segmentsTime-${index}`] = this.segments.append("g");
        });
    }

    createScales() {
        // Map time to angle
        this.timeScale = d3
            .scaleLinear()
            .domain([0, this.planet.duration])
            .range([this.constants.startAngle, this.constants.endAngle])
            .clamp(true);
        this.timeScalePrev = d3
            .scaleLinear()
            .domain([0, this.previous.duration])
            .range([
                this.constants.startAngle,
                this.isStart
                    ? this.constants.startAngle
                    : this.constants.endAngle,
            ])
            .clamp(true);

        // Map loudness to radius
        this.loudnessRadiusScale = d3
            .scaleLinear()
            .domain(
                this.isStart
                    ? [0, 0]
                    : d3.extent(
                          this.planet.analysis.sections,
                          (d) => d.loudness
                      )
            )
            .range([this.layers.loudnessStart, this.layers.loudnessEnd]);
        let loudnessRadiusScalePrev = d3
            .scaleLinear()
            .domain(
                d3.extent(this.previous.analysis.sections, (d) => d.loudness)
            )
            .range([this.layers.loudnessStart, this.layers.loudnessEnd]);
        this.loudnessRadiusScalePrev = (l) => {
            if (this.isStart) {
                return 0;
            }
            return loudnessRadiusScalePrev(l);
        };

        // Map key to tonic (I)
        this.keyConversion = (key, root) => {
            const newInt = key - root;
            return newInt < 0 ? newInt + this.pitchClasses.length : newInt;
        };

        // Map pitch to grid radius
        this.pitchScale = d3
            .scaleLinear()
            .domain([0, this.pitchClasses.length - 1])
            .range([this.layers.gridStart, this.layers.gridEnd]);

        // Map pitch to grid radius converted to tonic (I)
        this.pitchKeyScale = (integerNotation) =>
            this.pitchScale(
                this.keyConversion(integerNotation, this.planet.key)
            );

        // Map polar to rectangular coordinates
        const bisectionAngle =
            (this.constants.startAngle - this.constants.endAngle) / 2 -
            this.constants.startAngle;
        this.xScale = (radius, angle = bisectionAngle) =>
            radius * Math.cos(angle - Math.PI / 2);
        this.yScale = (radius, angle = bisectionAngle) =>
            radius * Math.sin(angle - Math.PI / 2);

        // Map pitch and time to rectangular coordinates on the grid
        this.pitchXScale = (angle, integerNotation) =>
            this.xScale(
                this.pitchKeyScale(integerNotation),
                angle // this.timeScale(time) or bisectionAngle
            );

        this.pitchYScale = (angle, integerNotation) =>
            this.yScale(
                this.pitchKeyScale(integerNotation),
                angle // this.timeScale(time) or bisectionAngle
            );

        // Map pitch duration to size
        this.pitchRadiusScale = d3
            .scaleSqrt()
            .domain([
                0,
                d3.max(this.planet.analysis.segments, (d) => d.duration / 2),
            ])
            .range([0, this.pitchScale(1.5) - this.pitchScale(0)]);

        // Map pitch to color
        this.pitchColorScale = d3
            .scaleLinear()
            .domain([0, 3, 4, 6, 7, 9, 11])
            .range([
                this.color.primary,
                this.color.secondary,
                this.color.tertiary,
                this.color.accent,
                this.color.tertiary,
                this.color.secondary,
                this.color.primary,
            ]);

        // Map confidence to opacity
        this.opacityScale = d3.scaleLinear().domain([0, 1]).range([0.2, 1]);

        // Create exponential scale for opacity (loudness)
        this.expScale = d3.scalePow().domain([5.1, 0]).exponent(0.2);
    }

    createColorScales() {
        this.colorBackgroundScale = d3.interpolateRgb(
            d3.color(this.prevColor.background),
            d3.color(this.color.background)
        );

        this.colorTextScale = d3.interpolateRgb(
            d3.color(this.prevColor.text),
            d3.color(this.color.text)
        );

        this.colorBlendScale = d3.interpolateRgb(
            d3.color(this.prevColor.blend),
            d3.color(this.color.blend)
        );
    }

    drawBackground(t) {
        d3.select("html")
            .style(
                "background-image",
                `radial-gradient(ellipse farthest-corner at 30% 30%, ${this.colorBackgroundScale(
                    t
                )} 50% , ${this.colorBlendScale(t)})`
            )
            .style("color", this.colorTextScale(t));

        d3.selectAll("a").style("color", this.colorTextScale(t));
    }

    updateLoudness() {
        // Make copies of data
        let prevPoints = [...this.previous.analysis.sections];
        let currPoints = [...this.planet.analysis.sections];

        // Make arrays have equal lengths by copying last value of the shorter array
        while (prevPoints.length < currPoints.length) {
            let lastElement = prevPoints[prevPoints.length - 1] || {
                start: 0,
                duration: 0,
                loudness: 0,
            };
            prevPoints.push({
                start:
                    lastElement.start +
                    (prevPoints.length === currPoints.length - 1
                        ? lastElement.duration / 4
                        : 0),
                duration: lastElement.duration,
                loudness: lastElement.loudness,
            });
        }
        while (currPoints.length < prevPoints.length) {
            let lastElement = currPoints[currPoints.length - 1] || {
                start: 0,
                duration: 0,
                loudness: 0,
            };
            currPoints.push({
                start:
                    lastElement.start +
                    (currPoints.length === prevPoints.length - 1
                        ? lastElement.duration / 4
                        : 0),
                duration: lastElement.duration,
                loudness: lastElement.loudness,
            });
        }

        for (let i = 5; i >= 0; i--) {
            let prevCoordinates = prevPoints.map((d) => {
                return {
                    angle: this.timeScalePrev(d.start + 0.5 * d.duration),
                    radius: this.loudnessRadiusScalePrev(d.loudness) + i * 5,
                };
            });
            let currCoordinates = currPoints.map((d) => {
                return {
                    angle: this.timeScale(d.start + 0.5 * d.duration),
                    radius: this.loudnessRadiusScale(d.loudness) + i * 5,
                };
            });

            let radial = d3
                .lineRadial()
                .angle((d) => d.angle)
                .radius((d) => d.radius)
                .curve(d3.curveCatmullRomClosed);

            this[`loudnessSections-${i}`]
                .attr("d", radial(prevCoordinates)) // previous (adjusted with extra points)
                .transition()
                .duration(this.duration)
                .attr("d", radial(currCoordinates)) // current
                .style("fill", this.color.accent)
                .style("opacity", this.expScale(i))
                .style("stroke-width", (i + 1) * 2);
        }
    }

    drawLoudness() {
        // Create glowy outline
        for (let i = 5; i >= 0; i--) {
            let node = this[`loudnessSections-${i}`];
            let area = node.attr("d");
            let path = new Path2D(area);
            this.context.globalAlpha = node.style("opacity");
            this.context.strokeStyle = node.style("fill");
            this.context.lineWidth = node.style("stroke-width");
            this.context.stroke(path);
        }
    }

    updateGrid() {
        // Draw legend
        this.gridLegend
            .transition()
            .duration(this.duration)
            .style("fill", this.color.text);

        // Add notation for pitches
        this.gridNotation
            .transition()
            .duration(this.duration)
            .attr(
                "y",
                (d) => -this.yScale(this.pitchKeyScale(d.integerNotation))
            )
            .style("fill", this.color.text);

        // Draw lines
        this.gridLines
            .transition()
            .duration(this.duration)
            .style("stroke", this.color.text);
    }

    drawGrid(t) {
        let self = this;

        // Grid Legend text
        this.context.globalAlpha =
            (this.isStart ? t : 1) * (self.isEnd ? 1 - t : 1);
        this.context.textAlign = "center";
        this.context.textBaseline = "middle";
        this.context.font = `${this.fonts.legend}px monaco`;

        this.gridLegend.each(function (d) {
            let node = d3.select(this);
            const midLayer =
                self.layers[`${d}Start`] +
                (self.layers[`${d}End`] - self.layers[`${d}Start`]) / 2;

            self.context.fillStyle = node.style("fill");
            self.context.fillText(
                node.text(),
                self.xScale(midLayer),
                -self.yScale(midLayer)
            );
        });

        // Grid Notation text
        this.gridNotation.each(function (d) {
            let node = d3.select(this);

            self.context.fillStyle = node.style("fill");
            self.context.fillText(node.text(), node.attr("x"), node.attr("y"));
        });

        // Grid lines
        this.context.globalAlpha = self.isEnd ? 1 - t : 1;
        this.context.lineWidth = 0.1;
        this.context.lineCap = "round";
        const endAngle =
            this.constants.startAngle +
            (this.isStart ? t : 1) *
                (this.constants.endAngle - this.constants.startAngle);
        this.gridLines.each(function (d) {
            let node = d3.select(this);
            let arc = d3
                .arc()
                .innerRadius(self.pitchKeyScale(d.integerNotation))
                .outerRadius(self.pitchKeyScale(d.integerNotation))
                .startAngle(self.constants.startAngle)
                .endAngle(endAngle)();
            let path = new Path2D(arc);

            self.context.strokeStyle = node.style("stroke");
            self.context.stroke(path);
        });
        this.context.globalAlpha = 1;
    }

    updateRhythm() {
        // Sections
        const sections = d3
            .pie()
            .value((d) => d.duration)
            .sort((a, b) => a.start < b.start)
            .padAngle(this.constants.anglePadding)
            .startAngle(this.constants.startAngle)
            .endAngle(this.constants.endAngle)(this.planet.analysis.sections);
        this.rhythmSections = this.rhythmSectionsG
            .selectAll("path")
            .data(sections, (d) => d.index)
            .join("path");
        this.rhythmSections
            .transition()
            .duration(this.duration)
            .style("fill", (d) =>
                this.pitchColorScale(
                    this.keyConversion(d.data.key, this.planet.key)
                )
            )
            .style("opacity", (d) => this.opacityScale(d.data.confidence));

        // Bars
        const self = this;
        function createPolygonPath(time) {
            // Get number of sides, radius, and position
            const numberSides = whatTimeSignature(time);
            const radius = (self.layers.barsEnd - self.layers.barsStart) / 2;
            const translateX = self.xScale(
                self.layers.barsStart + radius,
                self.timeScale(time)
            );
            const translateY = self.yScale(
                self.layers.barsStart + radius,
                self.timeScale(time)
            );

            // Create path
            const path = d3.path();
            if (numberSides < 3) {
                path.arc(translateX, translateY, radius, 0, 2 * Math.PI);
            } else {
                path.moveTo(
                    radius * Math.cos(0) + translateX,
                    radius * Math.sin(0) + translateY
                );
                for (let i = 1; i <= numberSides; i++) {
                    path.lineTo(
                        radius * Math.cos((i * 2 * Math.PI) / numberSides) +
                            translateX,
                        radius * Math.sin((i * 2 * Math.PI) / numberSides) +
                            translateY
                    );
                }
                path.closePath();
            }
            return path.toString();

            function whatTimeSignature(time) {
                for (let section of self.planet.analysis.sections) {
                    if (
                        time >= section.start &&
                        time < section.start + section.duration
                    ) {
                        return section.timeSignature;
                    }
                }
            }
        }
        this.rhythmBars = this.rhythmBarsG
            .selectAll("path")
            .data(this.planet.analysis.bars)
            .join("path")
            .attr("d", (d) => createPolygonPath(d.start))
            .style("opacity", (d) => this.opacityScale(d.confidence))
            .style("fill", this.color.secondary)
            .style("stroke", this.color.tertiary);

        // Minutes
        this.rhythmMinutes = this.rhythmMinutesG
            .selectAll("path")
            .data(d3.range(60, this.planet.duration, 60), (d) => d)
            .join(
                // Rotate when drawing
                (enter) =>
                    enter
                        .append("path")
                        .style("stroke", this.prevColor.text)
                        .style("opacity", 0)
                        .attr(
                            "d",
                            [
                                `M${0},${-this.layers.gridStart}`,
                                `L${0},${-this.layers.minutesEnd}`,
                            ].join(" ")
                        )
                        .transition()
                        .duration(this.duration)
                        .style("stroke", this.color.text)
                        .style("opacity", 1)
                        .selection(),
                (update) =>
                    update
                        .style("opacity", 1)
                        .transition()
                        .duration(this.duration)
                        .style("stroke", this.color.text)
                        .selection(),
                (exit) =>
                    exit
                        .style("opacity", 1)
                        .style("stroke", this.color.text)
                        .transition()
                        .duration(this.duration)
                        .style("opacity", 0)
                        .remove()
            );

        this.rhythmMinutesText = this.rhythmMinutesTextG
            .selectAll("text")
            .data(d3.range(60, this.planet.duration, 60), (d) => d)
            .join(
                // Rotate when drawing
                (enter) =>
                    enter
                        .append("text")
                        .text((d) => `${d / 60}:00`)
                        .attr("x", 0)
                        .attr("y", -this.layers.minutesEnd)
                        .style("opacity", 0)
                        .style("fill", this.prevColor.text)
                        .transition()
                        .duration(this.duration)
                        .style("opacity", 1)
                        .style("fill", this.color.text)
                        .selection(),
                (update) =>
                    update
                        .transition()
                        .duration(this.duration)
                        .style("opacity", 1)
                        .style("fill", this.color.text)
                        .selection(),
                (exit) =>
                    exit
                        .style("opacity", 1)
                        .style("fill", this.color.text)
                        .transition()
                        .duration(this.duration)
                        .style("opacity", 0)
                        .remove()
            );
    }

    drawRhythm(t) {
        let self = this;

        // Sections
        this.rhythmSections.each(function (d) {
            let node = d3.select(this);

            if (d.data.start < t * self.planet.duration) {
                let arc = d3
                    .arc()
                    .cornerRadius(
                        0.5 *
                            (self.layers.sectionsEnd -
                                self.layers.sectionsStart)
                    )
                    .innerRadius(self.layers.sectionsStart)
                    .outerRadius(self.layers.sectionsEnd)
                    .startAngle(d.startAngle)
                    .endAngle(
                        Math.min(
                            d.endAngle,
                            self.timeScale(t * self.planet.duration)
                        )
                    )();

                let path = new Path2D(arc);

                self.context.globalAlpha = node.style("opacity");
                self.context.fillStyle = node.style("fill");
                self.context.shadowBlur =
                    self.layers.sectionsEnd - self.layers.sectionsStart;
                self.context.shadowColor = node.style("fill");
                self.context.fill(path);
            }
        });
        this.context.shadowBlur = 0;

        // Bars
        this.rhythmBars.each(function (d) {
            if (d.start < t * self.planet.duration) {
                let node = d3.select(this);
                let arc = node.attr("d");
                let path = new Path2D(arc);

                self.context.globalAlpha = node.style("opacity");
                self.context.fillStyle = node.style("fill");
                self.context.strokeStyle = node.style("stroke");
                self.context.fill(path);
                self.context.stroke(path);
            }
        });
        this.context.globalAlpha = 1;

        // Minutes
        this.context.lineWidth = 1;
        this.context.lineCap = "round";
        this.context.setLineDash([15, 15]);
        this.rhythmMinutes.each(function (d) {
            let node = d3.select(this);
            let arc = node.attr("d");
            let path = new Path2D(arc);
            let angle =
                self.timeScalePrev(d) +
                t * (self.timeScale(d) - self.timeScalePrev(d));

            self.context.globalAlpha =
                angle === 2 * Math.PI ? 0 : node.style("opacity");
            self.context.strokeStyle = node.style("stroke");
            self.context.rotate(angle);
            self.context.beginPath();
            self.context.stroke(path);
            self.context.closePath();
            self.context.rotate(-angle);
        });
        this.rhythmMinutesText.each(function (d) {
            let node = d3.select(this);
            let angle =
                self.timeScalePrev(d) +
                t * (self.timeScale(d) - self.timeScalePrev(d));

            self.context.globalAlpha =
                angle === 2 * Math.PI ? 0 : node.style("opacity");
            self.context.fillStyle = node.style("fill");
            self.context.rotate(angle);
            self.context.fillText(node.text(), node.attr("x"), node.attr("y"));
            self.context.rotate(-angle);
        });

        // Return to defaults
        this.context.globalAlpha = 1;
        this.context.setLineDash([]);
    }

    updatePitches() {
        d3.range(this.pitchClasses.length).forEach((index) => {
            this[`segmentsPitches-${index}`] = this[`segmentsTime-${index}`]
                .selectAll("circle")
                .data(
                    this.planet.analysis.segments.filter(
                        (d) => d.pitches[index] > 0.8
                    ),
                    (d, i) => i // key: nth segment
                )
                .join("circle");

            this[`segmentsPitches-${index}`]
                .transition()
                .duration(this.duration)
                .attr("cx", (d) => {
                    return this.pitchXScale(
                        this.timeScale(d.start + d.duration / 2),
                        index
                    );
                })
                .attr("cy", (d) =>
                    this.pitchYScale(
                        this.timeScale(d.start + d.duration / 2),
                        index
                    )
                )
                .attr("r", (d) => this.pitchRadiusScale(d.duration))
                .style("opacity", (d) => d.pitches[index] - 0.8)
                .style(
                    "fill",
                    this.pitchColorScale(
                        this.keyConversion(index, this.planet.key)
                    )
                );
            this[`segmentsPitches-${index}`]
                .exit()
                .transition()
                .duration(this.duration)
                .attr("cx", 0)
                .attr("cy", 0)
                .style("opacity", 0)
                .remove();
        });
    }

    drawPitches(t) {
        let self = this;

        d3.range(this.pitchClasses.length).forEach((index) => {
            this[`segmentsPitches-${index}`].each(function (d) {
                if (!self.isStart || d.start < t * self.planet.duration) {
                    let node = d3.select(this);

                    self.context.globalAlpha =
                        (self.isEnd ? 1 - t : 1) * node.style("opacity");
                    self.context.fillStyle = node.style("fill");
                    // Only do filters at completion otherwise lag
                    if (t === 1) {
                        self.context.globalCompositeOperation = "soft-light";
                        self.context.shadowColor = node.style("fill");
                        self.context.shadowBlur = node.attr("r");
                    }

                    self.context.beginPath();
                    self.context.arc(
                        node.attr("cx"),
                        node.attr("cy"),
                        node.attr("r"),
                        0,
                        2 * Math.PI
                    );
                    self.context.closePath();
                    self.context.fill();
                }
            });
        });
        this.context.globalAlpha = 1;
        this.context.shadowBlur = 0;
        this.context.globalCompositeOperation = "source-over";
    }

    drawTitle(t) {
        // Format
        this.context.textBaseline = "middle";
        this.context.textAlign = "center";

        // Remove title 4x as fast
        this.context.globalAlpha = Math.max(1 - 4 * t, 0);
        this.context.fillStyle = this.prevColor.text;
        this.context.font = `${this.fonts.title}px Palatino`;
        this.context.fillText(this.previous.planet, 0, 0);
        this.context.font = `${this.fonts.description}px Palatino`;
        this.context.fillText(
            this.previous.description,
            0,
            0.85 * this.fonts.title
        );

        // Add title
        this.context.globalAlpha = Math.min(t, 1);
        this.context.fillStyle = this.color.text;
        this.context.font = `${this.fonts.title}px Palatino`;
        this.context.fillText(this.planet.planet, 0, 0);
        this.context.font = `${this.fonts.description}px Palatino`;
        this.context.fillText(
            this.planet.description,
            0,
            0.85 * this.fonts.title
        );

        // Return alpha to default
        this.context.globalAlpha = 1;
    }

    clear() {
        this.context.clearRect(
            -this.layers.whole,
            -this.layers.whole,
            2 * this.layers.whole,
            2 * this.layers.whole
        );
    }

    setPlanet(index, direction) {
        // Assign previous planet
        this.previous = this.planet;
        this.prevColor = this.colors[this.previous.planet];

        // Assign current planet
        this.planet = this.planets[index - (direction === "up" ? 1 : 0)];
        this.color = this.colors[this.planet.planet];

        // Create flags
        this.isStart = this.planet.planet === "Mars" && direction === "down";
        this.isEnd = this.planet.planet === "" && direction === "up";

        // Update data
        this.createScales();
        this.createColorScales();
        this.updateLoudness();
        this.updateGrid();
        this.updateRhythm();
        this.updatePitches();
    }

    renderPlanet() {
        if (this.planet.planet === this.previous.planet) return;
        let timer = d3.timer((elapsed) => {
            if (elapsed > this.duration) timer.stop();
            let t = Math.min(elapsed / this.duration, 1);
            this.clear();
            this.drawBackground(t);
            this.drawLoudness();
            this.drawGrid(t);
            this.drawRhythm(t);
            this.drawPitches(t);
            this.drawTitle(t);
        });
    }
}

const STYLE = `
    .responsive-calendar {
        position: relative;
        padding-bottom: 56.25%; /* 16:9 */
        padding-top: 25px;
        height: 0;
    }
    
    .responsive-calendar iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }
`;


class ResponsiveCalendarElement extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        const style = document.createElement("style");
        style.innerHTML = STYLE;
        this.appendChild(style);

        const frame = document.createElement("iframe");
        frame.src = "https://calendar.google.com/calendar/embed?height=600&wkst=1&ctz=America%2FLos_Angeles&showPrint=0&showTitle=0&showTz=0&src=Y185YmUxMzgwMWY1MjU4OTlmYWRiMjJiZGQxMzI2NTc5NzA2ZWE2NjY3ZTQ1NjBlZmI0ZWY0ZTE4YmUxNTY4ZWU2QGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&src=Y181NGY5OTY3OTk4MzA5NDk4OWI0NTZmZDc1MDZiNWQyMzYyMTk4MjU2ZDk3MDlmMzkyYmJiYjFkZTJkZTI0YzRjQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&src=Y185ZDQ5NDhiNmM1OTFjZTZlMmNkOTY5MjUzNDIxYTYzM2RhYThmOTc2Nzc0NDlmZjgyYTBhMDRiMTRkNmYzY2ZiQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20";

        const container = document.createElement("div");
        container.className = "responsive-calendar";
        container.appendChild(frame);
        this.appendChild(container);
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "src") {
            this.querySelector("iframe").src = newValue;
        }
    }

    static get observedAttributes() {
        return ["src"];
    }
}

customElements.define("responsive-calendar", ResponsiveCalendarElement);

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
        console.log("connected");
        const style = document.createElement("style");
        style.innerHTML = STYLE;
        this.appendChild(style);

        const frame = document.createElement("iframe");
        frame.className = "responsive-frame";
        frame.src = this.src;

        const container = document.createElement("div");
        container.className = "responsive-calendar";
        container.appendChild(frame);
        this.appendChild(container);
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "src") {
            console.debug(`Updating iframe src to: ${newValue}`);
            this.src = newValue;

            const iframe = this.querySelector("iframe");
            if (iframe) {
                iframe.src = newValue;
            }
        }
    }

    static get observedAttributes() {
        return ["src"];
    }
}

customElements.define("responsive-calendar", ResponsiveCalendarElement);

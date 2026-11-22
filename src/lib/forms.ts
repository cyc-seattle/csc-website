// Where the site's two forms post (cyc-seattle/csc-website#9). Both are on the public domain: the contact
// form reaches Directus at /forms/, and the signup reaches Listmonk, the newsletter.

/** Set PUBLIC_FORMS_URL to try the forms against dev: `https://mail.dev.cycsail.team`. */
const forms = import.meta.env["PUBLIC_FORMS_URL"] ?? "https://mail.cyccommunitysailing.org";

export const contactAction = `${forms}/forms/contact`;
export const subscribeAction = `${forms}/subscription/form`;

/** The CSC Newsletter list in Listmonk: platform's `listmonk:listId`. Set PUBLIC_NEWSLETTER_LIST_ID for dev's. */
export const newsletterListId = import.meta.env["PUBLIC_NEWSLETTER_LIST_ID"] ?? "2e604823-4eeb-4665-bbea-81a670bf48e3";

/** Where Listmonk sends a signup back to. Listmonk sends only to an address its settings list exactly. */
export const checkYourEmail = "https://cyccommunitysailing.org/newsletter/check-your-email";

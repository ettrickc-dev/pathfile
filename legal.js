// Easy Immigration Filing legal content. Plain text, shown in the in-app footer modal.
// IMPORTANT: These are reasonable starting templates, not a substitute for
// review by a licensed attorney in your state. Have a lawyer review before
// relying on them — especially the unauthorized-practice-of-law (UPL) and
// data-handling sections, which carry real liability for an immigration service.

export const COMPANY = "Easy Immigration Filing";
export const CONTACT_EMAIL = "easydivorcefiling@gmail.com";
export const EFFECTIVE = "June 28, 2026";

export const LEGAL = {
  terms: {
    title: "Terms of Service",
    sections: [
      ["1. What Easy Immigration Filing is — and is not",
        `${COMPANY} is a self-help document-preparation tool. It takes the information you type and places it onto official U.S. Citizenship and Immigration Services (USCIS) forms, then gives you the completed forms with instructions. ${COMPANY} is NOT a law firm, is NOT a substitute for an attorney, and does NOT provide legal advice, legal opinions, or representation. No attorney-client relationship is created by your use of this service. We do not select your immigration strategy, tell you whether you are eligible, or appear before USCIS for you. If you need legal advice, consult a licensed immigration attorney or an accredited representative.`],
      ["2. Your responsibility for accuracy",
        `You are responsible for the accuracy and completeness of everything you enter and everything you submit to USCIS. Before signing or mailing anything, you must review every form, confirm all answers are correct, fill in by hand any field you left blank, attach the required evidence, and confirm the current filing fee and mailing address at uscis.gov. Government forms, fees, and addresses change; we do not guarantee that any form version, fee, or address shown is current at the time you file.`],
      ["3. No guarantee of outcome",
        `${COMPANY} does not guarantee that USCIS will accept, approve, or grant any application or petition. Filing decisions rest entirely with USCIS and other government agencies. Our fee pays for document preparation only; it is separate from, and in addition to, any government filing fee.`],
      ["4. Eligibility and lawful use",
        `You must be at least 18 years old and provide truthful information. You agree not to use the service for any unlawful purpose or to submit false information to any government agency.`],
      ["5. Fees",
        `Our preparation fee is shown before you pay and is charged through our payment processor. Government filing fees are paid separately by you directly to USCIS.`],
      ["6. Limitation of liability",
        `To the fullest extent allowed by law, ${COMPANY} and its operators are not liable for any indirect, incidental, or consequential damages, or for any rejection, delay, or denial by USCIS. Our total liability for any claim is limited to the amount you paid us for the preparation service at issue.`],
      ["7. Changes",
        `We may update these Terms. Continued use after an update means you accept the revised Terms.`],
      ["8. Contact",
        `Questions about these Terms: ${CONTACT_EMAIL}.`],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      ["1. What we collect",
        `To prepare your forms we collect the information you enter, which may include your name, address, date and place of birth, contact details, and — only if you choose to provide them — sensitive identifiers such as your Social Security number and Alien Registration Number (A-Number). Sensitive fields are optional; you may leave them blank and complete them by hand on the printed form.`],
      ["2. How we use it",
        `We use your information solely to generate your completed forms and instructions, to deliver them to you, to process your payment, and to let you retrieve your documents later. We do not sell your personal information.`],
      ["3. Payment data",
        `Payments are processed by Stripe. We do not see or store your full card number; Stripe handles card data under its own security standards.`],
      ["4. Storage, retention, and security",
        `Your completed package and the email you provide are stored so you can retrieve your documents and so we can resolve any "I didn't receive it" disputes. We apply reasonable safeguards to protect this data and restrict access to it. No method of storage or transmission is perfectly secure, and we cannot guarantee absolute security. You may ask us to delete your stored documents and data at any time by emailing ${CONTACT_EMAIL}; we will delete them unless we are required to keep them.`],
      ["5. Sharing",
        `We share data only with the service providers that make the product work (for example, our payment processor and our email-delivery and hosting providers), and only as needed to provide the service, or when required by law. We do not file anything with USCIS on your behalf, and we do not transmit your information to any government agency.`],
      ["6. Your choices",
        `You can skip any optional field. You can request access to, correction of, or deletion of your stored information by emailing ${CONTACT_EMAIL}.`],
      ["7. Children",
        `The service is intended for use by adults (18+).`],
      ["8. Contact",
        `Privacy questions or deletion requests: ${CONTACT_EMAIL}.`],
    ],
  },
  refund: {
    title: "Refund Policy",
    sections: [
      ["1. What you are buying",
        `You are paying for a document-preparation service that generates your completed forms instantly after payment. Because the product is delivered immediately and digitally, please review the free draft preview carefully before you pay.`],
      ["2. When refunds are available",
        `If the service fails to deliver your completed forms, or the forms are defective due to our error, contact us within 7 days of purchase at ${CONTACT_EMAIL} and we will correct the problem or issue a full refund.`],
      ["3. When refunds are not available",
        `Because your forms are generated and delivered immediately, we generally cannot refund after the completed package has been delivered, except as described in section 2. We cannot refund based on a USCIS decision, a rejection caused by information you entered, evidence you did not include, a fee or address you did not confirm, or fields you did not complete by hand. Government filing fees are paid to USCIS, not to us, and are not refundable by us.`],
      ["4. How to request",
        `Email ${CONTACT_EMAIL} with your order email and a short description. We respond to refund requests promptly.`],
    ],
  },
};

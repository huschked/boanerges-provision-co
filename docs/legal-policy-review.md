# Legal and Customer-Trust Review

WEB-038 adds reviewable Privacy Policy and Terms of Service pages based on the data flows currently implemented in this repository. They are operational drafts, not legal advice or a substitute for review by the business owner and qualified counsel.

## Disclosed data flows

- Stripe processes payments and tax information.
- Firebase and Google Cloud store application, order, subscriber, contact, and admin-authentication data.
- Shippo and selected carriers receive shipment data.
- Resend delivers transactional and requested marketing email.
- Vercel hosts the site and processes ordinary request/log information.
- The application stores limited storefront analytics events, while the customer's cart persists in browser storage.
- The current code does not sell personal information or implement cross-context behavioral advertising.

## Owner review before launch

- Confirm the public business name and `support@`, `hello@`, and `orders@` responsibilities.
- Confirm that Minnesota is the intended governing-law state.
- Confirm every vendor and data category is described accurately.
- Establish actual record-retention periods for orders, inquiries, subscribers, operational logs, and analytics.
- Confirm the process for access, correction, deletion, and disclosure-list requests.
- Obtain legal review of the final Privacy Policy, Terms, refund policy, product disclaimers, and dietary/allergen language.
- Configure a valid postal address for marketing email. This may be different from the public contact-page presentation and should not expose a private residence without approval.
- Complete WEB-044 before sending production marketing campaigns so unsubscribe and sender-address requirements are handled end to end.

## Deployment checks

- Open `/privacy` and `/terms` directly on the deployed domain and refresh each route.
- Follow policy links from the footer, homepage newsletter form, and checkout newsletter consent.
- Confirm `/admin` is absent from customer navigation while direct protected access still works.
- Confirm fake phone/address values and placeholder social links are absent.
- Re-run the customer-facing internal-link check after every route or footer change.

## Authoritative references reviewed

- FTC, CAN-SPAM Act compliance guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- FTC, Protecting Personal Information guide: https://www.ftc.gov/system/files/documents/plain-language/pdf-0136_proteting-personal-information.pdf
- Minnesota Attorney General, MCDPA information for businesses: https://www.ag.state.mn.us/Data-Privacy/Business/

import { Link } from "wouter";
import { SiInstagram } from "react-icons/si";
import { useTheme } from "@/lib/theme";
import sgLogo from "../assets/showgate-logo.png";

const sections = [
  {
    title: "1. Introduction",
    content: [
      `Showgate ("we", "our", or "us") operates the event ticketing and management platform accessible via showgate.ng, its mobile applications, and associated services (collectively, the "Platform"). Showgate is domiciled in Jos, Plateau State, Nigeria.`,
      `We are committed to safeguarding the privacy of our users and ensuring the security of the personal data entrusted to us. This Privacy Policy details our practices regarding the collection, use, disclosure, and protection of your personal data when you interact with our Platform.`,
      `This Policy is formulated and governed in strict accordance with the Nigeria Data Protection Act 2023 (NDPA) and the General Application and Implementation Directive (GAID) 2025, issued by the Nigeria Data Protection Commission (NDPC). It is also informed by international data protection best practices, including the EU General Data Protection Regulation (GDPR), where applicable to cross-border data processing.`,
      `By accessing or utilizing the Platform, you acknowledge that you have read, understood, and agreed to the terms outlined in this Privacy Policy.`,
    ],
  },
  {
    title: "2. Data Controller Information",
    content: [
      `For the purposes of the NDPA, Showgate acts as the Data Controller responsible for determining the purposes and means of processing your personal data.`,
    ],
    details: [
      { label: "Entity Name", value: "Showgate" },
      { label: "Headquarters", value: "Jos, Plateau State, Nigeria" },
      { label: "Official Email", value: "hello@showgate.ng" },
      { label: "Website", value: "showgate.ng" },
    ],
  },
  {
    title: "3. Categories of Personal Data Collected",
    content: [
      `We collect personal data through voluntary user submission, automated background tracking, and authorized third-party integrations.`,
    ],
    subsections: [
      {
        heading: "3.1 Data Provided Directly by the User",
        items: [
          { label: "Identity Data", value: "Full name, profile configurations, and event organizer credentials." },
          { label: "Contact Data", value: "Email address, telephone number, and billing address." },
          { label: "Transaction Data", value: "Ticket preferences, order histories, and purchase metadata." },
          { label: "Financial Data", value: "Payment processing details. Note: Financial transactions are securely managed via our payment gateway partner, Paystack. Showgate does not store or have direct access to your card details or banking credentials." },
        ],
      },
      {
        heading: "3.2 Data Collected Automatically",
        items: [
          { label: "Technical Data", value: "Internet Protocol (IP) address, device type, browser specifications, and operating system." },
          { label: "Usage Data", value: "URL clickstreams, page dwell time, navigation paths, and platform interaction behavior." },
          { label: "Tracking Data", value: "Essential and non-essential cookies and session identifiers." },
        ],
      },
      {
        heading: "3.3 Data Inherited from Third Parties",
        items: [
          { label: "Payment Verification", value: "Transaction confirmation data transmitted securely from Paystack." },
          { label: "Communication Analytics", value: "Delivery, bounce, and open/click telemetry from Brevo (our transactional email processor)." },
        ],
      },
    ],
  },
  {
    title: "4. Lawful Bases and Purposes of Processing",
    content: [
      `In compliance with the NDPA, we process personal data under the following legitimate legal frameworks:`,
    ],
    labeledList: [
      { label: "Performance of Contract", value: "Provision of core ticketing infrastructure and digital ticket issuance; delivery of booking confirmations, receipt notes, and event updates; facilitation of attendee management and check-in tools for event organizers." },
      { label: "Consent", value: "Delivery of promotional marketing, newsletters, and tailored updates; deployment of non-essential cookies for behavioral analytics and optimization." },
      { label: "Legitimate Interests", value: "Continuous enhancement of Platform performance, interface, and features; diagnostics, system security auditing, and fraud prevention protocols; resolution of user disputes and enforcement of our Terms of Service." },
      { label: "Legal Obligation", value: "Adherence to statutory tax, corporate, and financial reporting duties under Nigerian law; compliance with lawful subpoenas, regulatory audits, or judicial demands." },
    ],
  },
  {
    title: "5. Information Sharing and Disclosure",
    content: [
      `Showgate does not sell, rent, or trade your personal data to third parties. We disclose data strictly to optimize platform operations, fulfill legal obligations, or finalize contractual agreements.`,
    ],
    subsections: [
      {
        heading: "5.1 Authorized Third-Party Data Processors",
        text: "We engage specialized service providers bound by strict confidentiality and Data Processing Agreements (DPAs) in compliance with the NDPA:",
        items: [
          { label: "Paystack", value: "Payment infrastructure (PCI-DSS compliant)." },
          { label: "Brevo (formerly Sendinblue)", value: "Transactional email delivery services." },
          { label: "Supabase", value: "Backend architectural infrastructure and database storage." },
          { label: "Vercel", value: "Frontend hosting and content delivery deployment." },
          { label: "Railway", value: "Specialized backend application server hosting." },
        ],
      },
      {
        heading: "5.2 Disclosure to Event Organizers",
        text: "When you register for or purchase a ticket to an event, relevant personal data (name, email address, and ticket metadata) is shared with the designated Event Organizer. This data is provided exclusively to facilitate event logistics, entry access control, and direct event-related updates.",
        items: [],
      },
      {
        heading: "5.3 Statutory and Legal Disclosures",
        text: "We reserve the right to disclose personal data to law enforcement, regulatory bodies, or judicial authorities if mandated by law, or if such action is deemed reasonably necessary to protect the safety, rights, and property of Showgate, its users, or the general public.",
        items: [],
      },
    ],
  },
  {
    title: "6. Cross-Border Data Transfers",
    content: [
      `Certain cloud infrastructure providers utilized by Showgate (e.g., Supabase, Vercel, Brevo) maintain server networks outside the Federal Republic of Nigeria. Where cross-border data transfer occurs, Showgate ensures that adequate safeguards are enforced to maintain data protection levels equivalent to the requirements under the NDPA. By utilizing the Platform, you acknowledge and consent to these cross-border processing operations.`,
    ],
  },
  {
    title: "7. Data Retention Policy",
    content: [
      `We retain your personal data only for the duration necessary to fulfill the purposes for which it was collected, as well as to satisfy legal, regulatory, or accounting requirements.`,
    ],
    labeledList: [
      { label: "Financial & Transactional Records", value: "Retained for a minimum of 6 years to comply with financial audits and corporate tax regulations." },
      { label: "Event & Attendee Data", value: "Retained for 2 years post-event date to resolve prospective ticket disputes or compliance inquiries." },
      { label: "Marketing Data", value: "Retained indefinitely until consent is explicitly withdrawn or an unsubscribe request is executed." },
      { label: "Technical Framework Logs", value: "Retained for up to 12 months for security profiling and infrastructure monitoring." },
    ],
    footer: "Upon expiration of the retention windows, data is permanently destroyed or irreversibly anonymized.",
  },
  {
    title: "8. Data Subject Rights",
    content: [
      `As a data subject under the NDPA, you possess comprehensive rights regarding your personal information:`,
    ],
    labeledList: [
      { label: "Right of Access", value: "Request and obtain confirmation of whether we process your data, alongside a copy of that data." },
      { label: "Right to Rectification", value: "Amend or correct inaccurate or incomplete personal records." },
      { label: 'Right to Erasure ("Right to be Forgotten")', value: "Request data deletion where statutory obligations do not supersede the request." },
      { label: "Right to Restriction of Processing", value: "Suspend active data processing under specific verification conditions." },
      { label: "Right to Data Portability", value: "Receive your personal data in a structured, machine-readable format for transfer to another controller." },
      { label: "Right to Object", value: "Contest processing operations founded on our legitimate interests or direct marketing initiatives." },
      { label: "Right to Withdraw Consent", value: "Revoke processing consent at any time, without affecting the lawfulness of processing handled prior to withdrawal." },
    ],
    footer: "To submit a formal rights request, please email hello@showgate.ng. We are legally obligated to verify your identity before processing requests and will issue a definitive response within 30 days of receipt.",
  },
  {
    title: "9. Cookies and Tracking Technologies",
    content: [
      `The Platform utilises cookies and similar tracking pixels to optimise user sessions, preserve system state preferences, analyse traffic trends, and implement anti-fraud defences.`,
      `Essential cookies are deployed automatically to sustain platform functionality. Non-essential cookies (such as analytics cookies) will only be activated with your explicit consent via our cookie notification banner. You can manage or disable cookie configurations via your browser settings; however, certain aspects of the Platform may lose functionality as a result.`,
    ],
  },
  {
    title: "10. Data Security Architecture",
    content: [
      `Showgate applies institutional, technical, and physical security measures designed to protect personal data against unauthorised access, alteration, disclosure, or destruction. Key protocols include:`,
    ],
    bulletList: [
      "End-to-end encryption of data in transit via HTTPS/TLS protocols.",
      "Restricted database access controls utilising enterprise-grade authentication via Supabase.",
      "Exclusion of raw financial instrument handling by delegating processing to PCI-DSS compliant gateways (Paystack).",
      `Enforcement of a "need-to-know" internal data access privilege policy for Showgate personnel.`,
    ],
    footer: "Data Breach Notification: In the highly unlikely event of a security breach compromising your personal data and posing a high risk to your rights, Showgate will formally report the incident to the NDPC within 72 hours and notify affected users without undue delay, outlining mitigating steps taken.",
  },
  {
    title: "11. Children's Privacy Protection",
    content: [
      `Our Platform is designed for use by individuals who are at least 13 years of age. Showgate does not knowingly collect or solicit personal data from children under the age of 13. If we discover that personal data has been inadvertently harvested from a child under 13, we will delete the record immediately. If you suspect a minor has provided us with unauthorised personal information, please alert us at hello@showgate.ng.`,
    ],
  },
  {
    title: "12. Amendments to this Privacy Policy",
    content: [
      `We reserve the right to modify or replace this Privacy Policy at our discretion to accommodate changes in law, business practices, or technical developments. Material adjustments will be communicated by updating the policy text on this page alongside a modified "Last Updated" timestamp, supplemented by direct email notifications to registered platform users where appropriate. Continued engagement with our Platform following an update denotes formal acceptance of the revised policy terms.`,
    ],
  },
  {
    title: "13. Contact Us & Regulatory Recourse",
    content: [
      `For comprehensive inquiries regarding this Policy, or to submit feedback regarding our data handling mechanisms, please contact our data compliance team:`,
    ],
    details: [
      { label: "Email", value: "hello@showgate.ng" },
      { label: "Digital Portal", value: "showgate.ng" },
    ],
    footer: `Should you feel that Showgate has handled your data unlawfully or failed to resolve a grievance adequately, you retain the statutory right to lodge an official complaint with the Nigeria Data Protection Commission (NDPC): ndpc.gov.ng | info@ndpc.gov.ng`,
  },
];

export default function Privacy() {
  const { isLight } = useTheme();
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)", color: "var(--text-main)" }}>
      {/* ── Minimal Navbar (logo only, no nav links) ───────────────────────── */}
      <nav className="sticky z-50 border-b border-zinc-800/60 backdrop-blur-md" style={{ top: "var(--maintenance-h, 0px)", backgroundColor: "var(--nav-bg)" }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center">
          <Link href="/">
            <span className="text-xl font-black tracking-tight cursor-pointer">
              Show<span className="text-amber-400">gate</span>
              <img src={sgLogo} alt="" className="inline-block h-[22px] w-auto ml-2 align-middle" />
            </span>
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[220px] sm:min-h-[260px] flex items-center pt-16 pb-10 px-5 border-b border-zinc-800/50">
        <div className="absolute inset-0" style={{ background: isLight ? "linear-gradient(to bottom, rgba(245,158,11,0.07), rgba(245,158,11,0.18))" : "linear-gradient(to bottom, rgba(120,53,15,0.2), rgba(13,13,13,0.3), #0d0d0d)" }} />
        <div className="relative z-10 max-w-3xl mx-auto w-full text-center">
          <p className="text-amber-400 text-xs font-black uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl sm:text-5xl font-black mb-3">
            Privacy <span className="text-amber-400">Policy</span>
          </h1>
          <p className="text-zinc-400 text-sm">
            Effective Date: 26 June 2026 &nbsp;·&nbsp; Last Updated: June 2026
          </p>
          <p className="text-zinc-500 text-xs mt-1">
            Platform: showgate.ng &nbsp;·&nbsp; Contact:{" "}
            <a href="mailto:hello@showgate.ng" className="hover:text-amber-400 transition-colors">hello@showgate.ng</a>
          </p>
        </div>
      </section>

      {/* ── Policy content ─────────────────────────────────────────────────── */}
      <section className="py-14 px-5">
        <div className="max-w-3xl mx-auto space-y-12">
          {sections.map((sec) => (
            <div key={sec.title} className="border-t border-zinc-800/70 pt-10 first:border-t-0 first:pt-0">
              <h2 className="text-lg sm:text-xl font-black text-white mb-5">{sec.title}</h2>

              {/* Main paragraphs */}
              {sec.content?.map((p, i) => (
                <p key={i} className="text-zinc-400 text-sm leading-relaxed mb-4">{p}</p>
              ))}

              {/* Key-value details (e.g. Data Controller info) */}
              {sec.details && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mt-4 grid sm:grid-cols-2 gap-3">
                  {sec.details.map((d) => (
                    <div key={d.label}>
                      <p className="text-zinc-500 text-xs uppercase tracking-widest mb-0.5">{d.label}</p>
                      <p className="text-zinc-300 text-sm font-medium">{d.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Labeled list (purposes, rights, retention) */}
              {sec.labeledList && (
                <div className="space-y-3 mt-4">
                  {sec.labeledList.map((item) => (
                    <div key={item.label} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                      <p className="text-amber-400 text-xs font-black uppercase tracking-widest mb-1">{item.label}</p>
                      <p className="text-zinc-400 text-sm leading-relaxed">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Bullet list (security measures) */}
              {sec.bulletList && (
                <ul className="mt-4 space-y-2">
                  {sec.bulletList.map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm text-zinc-400 leading-relaxed">
                      <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {/* Subsections */}
              {sec.subsections?.map((sub) => (
                <div key={sub.heading} className="mt-6">
                  <h3 className="text-sm font-black text-zinc-300 uppercase tracking-widest mb-3">{sub.heading}</h3>
                  {sub.text && <p className="text-zinc-400 text-sm leading-relaxed mb-3">{sub.text}</p>}
                  {sub.items && sub.items.length > 0 && (
                    <div className="space-y-3">
                      {sub.items.map((item) => (
                        <div key={item.label} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                          <p className="text-amber-400 text-xs font-black uppercase tracking-widest mb-1">{item.label}</p>
                          <p className="text-zinc-400 text-sm leading-relaxed">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Footer note for some sections */}
              {sec.footer && (
                <p className="text-zinc-500 text-sm leading-relaxed mt-4 italic">{sec.footer}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-amber-500/20 py-10 px-5">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center gap-2">
          <span className="text-lg font-black">
            Show<span className="text-amber-400">gate</span>
            <img src={sgLogo} alt="" className="inline-block h-[20px] w-auto ml-2 align-middle" />
          </span>
          <p className="text-zinc-500 text-xs">The easiest way to run your event.</p>
          <a href="mailto:support@showgate.ng" className="text-zinc-500 text-xs hover:text-amber-400 transition-colors">support@showgate.ng</a>
          <a href="https://www.instagram.com/showgate.ng/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-zinc-500 hover:text-amber-400 transition-colors mt-1">
            <SiInstagram className="w-4 h-4" />
          </a>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-zinc-600 text-xs">© {new Date().getFullYear()} Showgate. All rights reserved.</p>
            <span className="text-zinc-700 text-xs">·</span>
            <Link href="/privacy">
              <span className="text-zinc-600 text-xs hover:text-amber-400 transition-colors cursor-pointer">Privacy Policy</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

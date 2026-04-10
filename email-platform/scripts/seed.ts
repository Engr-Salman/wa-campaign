/**
 * Seed script — demo data for local development.
 *
 * Creates:
 *   - 1 Organization ("Acme Demo")
 *   - 1 OWNER user (demo@bulkmail.local / demo-password-12345)
 *   - 1 SMTP sender pointed at MailHog (localhost:1025)
 *   - 1 Contact list ("Newsletter subscribers") with ~10 sample contacts
 *   - 1 MJML welcome template
 *   - 1 Draft campaign using the list and template
 *
 * Run with: pnpm db:seed   (or: npx tsx scripts/seed.ts)
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { encryptJson, randomToken } from "../src/lib/crypto";
import { compileTemplate } from "../src/server/services/templates";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@bulkmail.local";
const DEMO_PASSWORD = "demo-password-12345";

const DEMO_CONTACTS = [
  { email: "alice@example.com", firstName: "Alice", lastName: "Andrews", company: "Orbit Labs" },
  { email: "bob@example.com", firstName: "Bob", lastName: "Brown", company: "Helix Inc" },
  { email: "carol@example.com", firstName: "Carol", lastName: "Chen", company: "Vector Co" },
  { email: "dave@example.com", firstName: "Dave", lastName: "Diaz", company: "Nimbus" },
  { email: "eve@example.com", firstName: "Eve", lastName: "Evans", company: "Stratus" },
  { email: "frank@example.com", firstName: "Frank", lastName: "Foster", company: "Axiom" },
  { email: "grace@example.com", firstName: "Grace", lastName: "Gomez", company: "Cirrus" },
  { email: "henry@example.com", firstName: "Henry", lastName: "Hughes", company: "Zenith" },
  { email: "iris@example.com", firstName: "Iris", lastName: "Ito", company: "Nebula" },
  { email: "jack@example.com", firstName: "Jack", lastName: "Johnson", company: "Prism" },
];

const DEMO_MJML = `<mjml>
  <mj-head>
    <mj-title>Welcome to {{company_name}}</mj-title>
    <mj-preview>Thanks for subscribing — here's what to expect.</mj-preview>
    <mj-attributes>
      <mj-all font-family="Helvetica, Arial, sans-serif" />
      <mj-text font-size="15px" color="#333" line-height="1.6" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f7">
    <mj-section background-color="#ffffff" padding="32px 24px">
      <mj-column>
        <mj-text font-size="22px" font-weight="700" color="#111">
          Hi {{first_name}}, welcome aboard!
        </mj-text>
        <mj-text>
          Thanks for subscribing. We'll send you a thoughtfully curated digest
          once a week — no spam, ever.
        </mj-text>
        <mj-button background-color="#4f46e5" href="https://example.com/getting-started">
          Get started
        </mj-button>
        <mj-text color="#888" font-size="13px">
          Not interested anymore? <a href="{{unsubscribe_url}}">Unsubscribe</a>
          or <a href="{{preferences_url}}">manage preferences</a>.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

async function main() {
  console.log("Seeding demo data...");

  // Organization
  const org = await prisma.organization.upsert({
    where: { slug: "acme-demo" },
    update: {},
    create: {
      name: "Acme Demo",
      slug: "acme-demo",
      legalName: "Acme Demo, Inc.",
      addressLine1: "123 Market Street",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "USA",
      defaultFromName: "Acme Team",
      defaultFromEmail: "hello@acme.test",
      enforceUnsubFooter: true,
      requireDoubleOptIn: false,
      largeSendThreshold: 5000,
    },
  });
  console.log(`  organization: ${org.slug}`);

  // Owner user
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash },
    create: {
      email: DEMO_EMAIL,
      name: "Demo Owner",
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: { role: "OWNER" },
    create: { userId: user.id, organizationId: org.id, role: "OWNER" },
  });
  console.log(`  user:         ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

  // MailHog SMTP sender (no auth; works against docker-compose MailHog)
  const smtpConfig = {
    type: "SMTP" as const,
    host: "localhost",
    port: 1025,
    secure: false,
    username: undefined,
    password: undefined,
  };
  let sender = await prisma.senderAccount.findFirst({
    where: { organizationId: org.id, name: "MailHog (local dev)" },
  });
  if (!sender) {
    sender = await prisma.senderAccount.create({
      data: {
        organizationId: org.id,
        name: "MailHog (local dev)",
        type: "SMTP",
        status: "VERIFIED",
        fromName: "Acme Team",
        fromEmail: "hello@acme.test",
        replyTo: "support@acme.test",
        configEncrypted: encryptJson(smtpConfig),
        lastVerifiedAt: new Date(),
      },
    });
  }
  console.log(`  sender:       ${sender.name}`);

  // Contact list
  const list = await prisma.contactList.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Newsletter subscribers" } },
    update: {},
    create: {
      organizationId: org.id,
      name: "Newsletter subscribers",
      description: "Opted-in contacts from the marketing site.",
    },
  });
  console.log(`  list:         ${list.name}`);

  // Contacts
  for (const c of DEMO_CONTACTS) {
    const contact = await prisma.contact.upsert({
      where: { organizationId_email: { organizationId: org.id, email: c.email } },
      update: {},
      create: {
        organizationId: org.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        status: "SUBSCRIBED",
        source: "seed",
        consentAt: new Date(),
        attributes: { company: c.company },
      },
    });
    await prisma.contactListMember.upsert({
      where: { listId_contactId: { listId: list.id, contactId: contact.id } },
      update: {},
      create: { listId: list.id, contactId: contact.id },
    });
  }
  console.log(`  contacts:     ${DEMO_CONTACTS.length}`);

  // Template
  const { html: compiledHtml } = compileTemplate(DEMO_MJML, "MJML");
  const template = await prisma.template.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Welcome email" } },
    update: { source: DEMO_MJML, compiledHtml },
    create: {
      organizationId: org.id,
      name: "Welcome email",
      description: "Default welcome message for new subscribers.",
      kind: "MJML",
      source: DEMO_MJML,
      compiledHtml,
      subject: "Welcome to Acme, {{first_name}}!",
      preheader: "Thanks for subscribing — here's what to expect.",
    },
  });
  console.log(`  template:     ${template.name}`);

  // Draft campaign
  const existing = await prisma.campaign.findFirst({
    where: { organizationId: org.id, name: "Welcome drip — week 1" },
  });
  if (!existing) {
    const campaign = await prisma.campaign.create({
      data: {
        organizationId: org.id,
        name: "Welcome drip — week 1",
        subject: "Welcome to Acme, {{first_name}}!",
        preheader: "Thanks for subscribing.",
        status: "DRAFT",
        senderAccountId: sender.id,
        templateId: template.id,
        utmSource: "newsletter",
        utmMedium: "email",
        utmCampaign: "welcome-w1",
        listTargets: { create: [{ listId: list.id }] },
      },
    });
    console.log(`  campaign:     ${campaign.name} (draft)`);
  } else {
    console.log(`  campaign:     already exists`);
  }

  // Suppression entry demo (blocked@example.com always rejected)
  await prisma.suppressionEntry.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "blocked@example.com" } },
    update: {},
    create: {
      organizationId: org.id,
      email: "blocked@example.com",
      reason: "MANUAL",
      note: "Demo suppression entry",
    },
  });

  console.log("\nDone. Sign in with:");
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  // Silence unused warning for randomToken import — kept available for future use
  void randomToken;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

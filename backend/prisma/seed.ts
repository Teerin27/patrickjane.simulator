// (DUMMY) Seeds the sample case used by the frontend prototype.
// Later, case files will live in /cases as JSON and be validated against the shared schema.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const sampleCase = {
  slug: 'case-0417-blue-lantern',
  title: 'patricjane.sim',
  number: 'Case 0417',
  suspects: [
    { id: 'lorraine', short: 'L. VOSS', surname: 'Voss', role: 'Singer', alibi: 'Alone in her dressing room after the 11:40 set.', opener: 'Make it quick, detective. I have a second set to think about.', closer: 'That is enough. Talk to my lawyer.' },
    { id: 'pike', short: 'DR. PIKE', surname: 'Pike', role: 'Doctor', alibi: 'Cards upstairs with the club accountant.', opener: 'I told the officers everything. A doctor does not forget a card game.', closer: 'I have nothing more to say to you.' },
    { id: 'doyle', short: 'M. DOYLE', surname: 'Doyle', role: 'Barman', alibi: 'Behind the bar all night. Never left it.', opener: 'I pour drinks. I see everybody and I say nothing. That is the job.', closer: 'Bar is closed, detective. Get out.' },
  ],
  evidence: [
    { id: 'key', tag: 'EXH.A', name: 'Brass key', sprite: 'key', note: 'Found under the desk. Stamped "BL-2", the office door.' },
    { id: 'letter', tag: 'EXH.B', name: 'Burned letter', sprite: 'letter', note: 'Charred scrap: "...pay by Friday or I tell Pike."' },
    { id: 'ticket', tag: 'EXH.C', name: 'Rail ticket', sprite: 'ticket', note: 'Union Station stub, stamped 11:52 PM, the night of the murder.' },
    { id: 'glass', tag: 'EXH.D', name: 'Lipstick glass', sprite: 'glass', note: 'Rye glass on the desk. Dark red on the rim.' },
  ],
  truth: {
    culpritId: 'doyle',
    verdictCorrect: 'Doyle slipped out on the 11:52 and used the spare key from behind his bar. The cuffs go on.',
    verdictWrong: 'Your suspect walks. The real killer pours the next round. Check the ticket stub and the spare keys.',
    reactions: {
      lorraine: {
        glass: { text: 'That is my shade. Fine. I had a drink with him at ten. I left him alive and sulking.', kind: 'contradiction', mood: 'nervous', note: 'Voss lied: she was in the office.' },
        ticket: { text: 'I have never ridden a train. Somebody is planting trash on me.', kind: 'deflect', mood: 'angry' },
        letter: { text: 'It names Pike. Why show it to me?', kind: 'deflect', mood: 'nervous' },
        key: { text: 'Every stagehand has one of those. Ask someone with more to hide.', kind: 'deflect', mood: 'calm' },
      },
      pike: {
        letter: { text: 'Where did you find that? Victor was bleeding me dry. I did not kill him. I wanted to, God help me.', kind: 'truth', mood: 'broken', note: 'Pike was being blackmailed by Hale.' },
        ticket: { text: 'A train? Coincidence. I was upstairs. Finch will swear to it.', kind: 'deflect', mood: 'nervous' },
        key: { text: 'I never held that key. My business with Victor was done in the open.', kind: 'deflect', mood: 'calm' },
        glass: { text: 'Lipstick? Do I look like I wear lipstick, detective?', kind: 'deflect', mood: 'angry' },
      },
      doyle: {
        ticket: { text: 'Fine. I stepped out for the late train. I was back before anyone noticed, I swear.', kind: 'contradiction', mood: 'broken', note: 'Doyle left the bar at 11:52. Alibi broken.' },
        key: { text: 'The spare set hangs behind my bar. Anybody could have grabbed it. Not me.', kind: 'contradiction', mood: 'nervous', note: "Spare office keys hang behind Doyle's bar." },
        letter: { text: 'Never seen it. Victor kept his dirt to himself.', kind: 'deflect', mood: 'calm' },
        glass: { text: "A customer's glass. We lose three a night upstairs.", kind: 'deflect', mood: 'calm' },
      },
    },
  },
}

async function main() {
  const { slug, ...data } = sampleCase
  const c = await prisma.case.upsert({ where: { slug }, create: sampleCase, update: data })
  console.log(`Seeded case ${c.slug} (${c.id})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

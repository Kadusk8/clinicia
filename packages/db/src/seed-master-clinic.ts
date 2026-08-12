import 'dotenv/config';
import { db, schema } from './index';
import { eq } from 'drizzle-orm';

interface SeedService {
  id: string;
  name: string;
  priceCents: number;
}

interface SeedDentist {
  id: string;
  name: string;
  speciality: string;
  services: SeedService[];
}

interface SeedContext {
  clinicId: string;
  dentists: SeedDentist[];
}

// =====================================================
// DATA GENERATORS (Realistic Brazilian Portuguese)
// =====================================================

const FEMALE_FIRST_NAMES = [
  'Amanda', 'Ana', 'Andrea', 'Aline', 'Bruna', 'Beatriz', 'Camila', 'Carla', 'Cecília', 'Claudia',
  'Danielle', 'Débora', 'Denise', 'Eliana', 'Fernanda', 'Gabriela', 'Gisele', 'Heloísa', 'Helena', 'Isabela',
  'Janaina', 'Jaqueline', 'Jessica', 'Joana', 'Joyce', 'Juliana', 'Kátia', 'Karolina', 'Larissa', 'Leticia',
  'Lídia', 'Luciana', 'Luísa', 'Márcia', 'Maria', 'Mariana', 'Marisa', 'Marta', 'Mayara', 'Melissa',
  'Michele', 'Milena', 'Mônica', 'Natália', 'Patrícia', 'Priscila', 'Renata', 'Roberta', 'Sabrina', 'Sandra',
  'Simone', 'Sônia', 'Tatiana', 'Valéria', 'Vanessa', 'Vitória', 'Yasmin',
];

const MALE_FIRST_NAMES = [
  'André', 'Antônio', 'Artur', 'Augusto', 'Bruno', 'Caio', 'Carlos', 'Cláudio', 'Daniel', 'Diego',
  'Eduardo', 'Fábio', 'Felipe', 'Fernando', 'Gabriel', 'Gustavo', 'Henrique', 'Hugo', 'Igor', 'Jorge',
  'José', 'Leandro', 'Lucas', 'Marcelo', 'Marcos', 'Mateus', 'Maurício', 'Nelson', 'Otávio', 'Paulo',
  'Pedro', 'Rafael', 'Renato', 'Ricardo', 'Roberto', 'Rodrigo', 'Sérgio', 'Thiago', 'Vinícius', 'Wagner',
];

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Costa', 'Alves', 'Ferreira', 'Gomes', 'Martins', 'Pereira', 'Ribeiro',
  'Sousa', 'Rocha', 'Tavares', 'Dias', 'Barbosa', 'Monteiro', 'Lopes', 'Carvalho', 'Fernandes', 'Pinto',
  'Mota', 'Machado', 'Castro', 'Nunes', 'Mendes', 'Peixoto', 'Amaral', 'Medeiros', 'Melo', 'Leal',
  'Rodrigues', 'Teixeira', 'Borges', 'Braga', 'Moraes', 'Araújo', 'Campos', 'Azevedo', 'Camargo', 'Correia',
];

function randomEl<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = tmp;
  }
  return copy;
}

function firstOrThrow<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new Error('Expected at least one row from insert/select');
  return row;
}

const usedNames = new Set<string>();
const usedPhones = new Set<string>();

function generatePhone(): string {
  let phone: string;
  do {
    const first = String(randomInt(90000, 99999));
    const second = String(randomInt(1000, 9999));
    phone = `5562${first}${second}`;
  } while (usedPhones.has(phone));
  usedPhones.add(phone);
  return phone;
}

interface PatientName {
  full: string;
  first: string;
  female: boolean;
  obg: string; // "obrigado"/"obrigada" agreed with the patient's gender
}

function generateName(): PatientName {
  let full = '';
  let first = '';
  let female = false;
  do {
    female = Math.random() < 0.55;
    first = randomEl(female ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES);
    const last1 = randomEl(LAST_NAMES);
    const last2 = randomEl(LAST_NAMES);
    full = last1 === last2 ? `${first} ${last1}` : `${first} ${last1} ${last2}`;
  } while (usedNames.has(full));
  usedNames.add(full);
  return { full, first, female, obg: female ? 'obrigada' : 'obrigado' };
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function priceRangeText(service: SeedService): string {
  const low = Math.round((service.priceCents * 0.85) / 100) * 100;
  const high = Math.round((service.priceCents * 1.15) / 100) * 100;
  return `entre ${formatPrice(low)} e ${formatPrice(high)}`;
}

// =====================================================
// CONVERSATION HOUR DISTRIBUTION
// =====================================================

type HourBucket = 'dawn' | 'earlyMorning' | 'business' | 'evening';

function buildHourPlan(total: number): HourBucket[] {
  const dawnCount = 4; // 00h-05h (madrugada)
  const earlyCount = 3; // 06h-08h (bem cedo)
  const eveningCount = 7; // 19h-23h (à noite)
  const businessCount = total - dawnCount - earlyCount - eveningCount;
  const plan: HourBucket[] = [
    ...Array(dawnCount).fill('dawn'),
    ...Array(earlyCount).fill('earlyMorning'),
    ...Array(eveningCount).fill('evening'),
    ...Array(businessCount).fill('business'),
  ];
  return shuffle(plan);
}

function hourForBucket(bucket: HourBucket): number {
  switch (bucket) {
    case 'dawn': return randomInt(0, 5);
    case 'earlyMorning': return randomInt(6, 8);
    case 'evening': return randomInt(19, 23);
    default: return randomInt(9, 18);
  }
}

// =====================================================
// MESSAGE POOLS (Brazilian Portuguese, casual WhatsApp style)
// =====================================================

const CONVERSATION_STARTERS = [
  'Oi, boa tarde! Achei vocês no Google, vi as avaliações 😊',
  'Olá, vi a página de vocês no Insta, como funciona pra agendar?',
  'Oi, quanto fica mais ou menos uma avaliação com vocês?',
  'Olá, gostaria de tirar uma dúvida sobre aparelho',
  'Oi, tenho bastante medo de dentista, como vocês lidam com isso?',
  'Olá, vocês podem me passar os valores dos procedimentos?',
  'Oi, uma amiga minha se tratou aí e recomendou, como faço pra marcar?',
  'Olá, vocês fazem clareamento? Tenho muito interesse em fazer',
  'Oi, acabei de me mudar pra região, vocês ainda estão aceitando pacientes novos?',
  'Boa noite, vi o número de vocês no cartão que peguei na recepção de um amigo',
  'Oi, faz tempo que quero cuidar dos dentes, vocês têm horário essa semana?',
  'Olá, gostaria de saber se vocês atendem convênio',
  'Oi, minha filha precisa ir ao dentista, vocês atendem criança?',
  'Oi, vi um vídeo de vocês explicando sobre implante e bateu uma curiosidade',
  'Olá, queria agendar uma limpeza, faz tempo que não vou ao dentista rs',
  'Oi, esse número é da clínica que fica perto da praça?',
  'Bom dia, gostaria de informações sobre facetas de resina',
  'Oi, tô pensando em fazer aparelho, é minha primeira vez',
  'Olá, vocês têm horário de manhã bem cedo? Trabalho o dia inteiro',
  'Oi, uma colega de trabalho passou o contato de vocês',
];

const PRICE_QUESTIONS = [
  'quanto fica o {service}?',
  'qual o valor do {service} de vocês?',
  'vocês sabem me dizer quanto custa em média um {service}?',
  'e o preço do {service}, dá pra adiantar?',
  'só queria saber a faixa de preço do {service} antes de ir aí',
];

function priceReplyTemplates(first: string, service: SeedService, dentistArticle: string, dentistTitle: string): string[] {
  return [
    `${first}, o ${service.name} geralmente fica ${priceRangeText(service)}, mas o valor certinho só fecha depois da avaliação presencial, cada caso é um caso 🙂 Consegue passar aqui na clínica pra gente ver de perto?`,
    `Boa pergunta! Em média o pessoal paga ${priceRangeText(service)} nesse procedimento, ${first}. Mas pra te dar o valor exato preciso que ${dentistArticle} ${dentistTitle} avalie você aqui na clínica, sem compromisso. Quer vir dar uma olhada?`,
    `${first}, aqui só passamos valor fechado depois da avaliação presencial — em geral fica ${priceRangeText(service)}. Consigo te encaixar pra uma avaliação, aí já sai com o orçamento certinho na mão. Topa vir até a clínica?`,
    `Olha, a faixa costuma ser ${priceRangeText(service)}, mas isso pode variar bastante de acordo com o seu caso. O ideal é você vir aqui na clínica pra avaliação, aí a gente fecha o valor exato ali mesmo. Quer que eu já veja um horário?`,
    `${first}, sem te enrolar: fica ${priceRangeText(service)} na média. Mas só cravamos o valor final com você aqui, pessoalmente — assim ${dentistArticle} ${dentistTitle} já explica tudo direitinho. Bora marcar a avaliação?`,
  ];
}

const OBJECTIONS_PRICE = [
  'Nossa, tá bem salgado pra mim agora 😕 tem como parcelar?',
  'Entendi, mas o valor tá pesado pro meu bolso esse mês...',
  'Poxa, achei que fosse mais em conta, vou ter que pensar',
  'Hmm, é bastante coisa. Vocês parcelam no cartão?',
  'Ai, não sei se vai dar certo agora, tá corrido financeiramente',
];

const OBJECTIONS_INSURANCE = [
  'Vocês fecham com Unimed? Porque particular fica difícil pra mim',
  'E convênio, vocês aceitam? Tenho Bradesco Saúde',
  'Não tenho plano não, só particular mesmo. Tem desconto à vista?',
  'Vocês têm parceria com a Amil? Preciso confirmar antes',
];

const OBJECTIONS_FEAR = [
  'Ai eu tenho muito medo mesmo, será que vou aguentar 😰',
  'É que a última vez que fui ao dentista foi bem traumático pra mim',
  'Fico morrendo de medo só de pensar na cadeira do dentista',
];

const OBJECTIONS_SCHEDULE = [
  'Só posso ir final de semana, vocês abrem sábado?',
  'Minha agenda tá impossível essa semana, tem horário mais pra frente?',
  'Só consigo depois das 18h, vocês têm vaga nesse horário?',
];

const FULL_NAME_ASK = [
  'Perfeito! Pra eu já deixar registrado no sistema, pode me confirmar seu nome completo?',
  'Ótimo, vou preparar seu cadastro. Qual seu nome completo mesmo?',
  'Show! Só preciso do seu nome completo pra fechar o agendamento aqui no sistema.',
  'Bacana! Antes de confirmar, me passa seu nome completinho, por favor?',
];

const NAME_CONFIRM_REPLIES = [
  'É {name}, isso mesmo',
  '{name}',
  'Meu nome completo é {name}',
  'Pode anotar: {name}',
];

const SCHEDULING_QUESTIONS = [
  'Certo! Qual dia fica melhor pra você, {day} ou {day2}?',
  'Beleza! Você prefere de manhã, à tarde ou à noite?',
  'Show! Essa semana ou a que vem fica melhor pra você?',
  'Perfeito! Tem preferência de dia da semana?',
];

const SCHEDULING_PATIENT_REPLIES = [
  '{day} pra mim é ótimo',
  'Pode ser à tarde, se tiver horário',
  'Prefiro de manhã bem cedo, se possível',
  'Qualquer horário serve, só me avisa o dia certo',
  'Essa semana mesmo, quanto antes melhor',
];

const CONFIRMATION_TEMPLATES = [
  '{first}, ficou confirmado então: {day} às {time} com {dentist}, para {service}. Te espero aqui na clínica! 📅',
  'Prontinho, {first}! Agendei {day} às {time} com {dentist} para o seu {service}. Qualquer imprevisto me avisa por aqui mesmo 😊',
  'Fechado! {day}, {time}, {dentist} vai te atender para {service}. Chega uns 10 minutinhos antes pra fazer a ficha, tá bom?',
];

const CLOSING_CONFIRMED = [
  'Perfeito, muito {obg}! Até lá 😊',
  'Combinado, vou anotar aqui, {obg}!',
  'Ótimo, confirmado! Até mais',
  'Show, pode contar comigo, vou estar aí',
];

const FOLLOWUP_AGENT_REOPEN = [
  '{first}, tudo bem? 😊 Passando pra saber se você já conseguiu pensar sobre o {service} que conversamos',
  'Oi {first}! Ainda tá com interesse em fazer o {service}? Fico à disposição pra tirar qualquer dúvida',
  '{first}, oi! Vi que ficamos de continuar a conversa sobre o {service}. Ainda faz sentido pra você?',
  'Olá {first}, só um lembrete carinhoso: seguimos com vaga em aberto pra você fazer o {service} quando quiser 🙂',
];

const FOLLOWUP_PATIENT_STALL = [
  'Ainda tô pensando, é que os valores pesam um pouco',
  'Quero fazer sim, só preciso organizar as contas esse mês',
  'Vou ver com calma e te chamo, pode ser?',
  'Preciso conversar em casa antes, mas não esqueci de vocês',
  'Ainda não decidi, mas {obg} por lembrar',
];

const FOLLOWUP_AGENT_CLOSE = [
  'Sem pressa nenhuma, {first}! Fico por aqui aguardando, é só me chamar quando decidir 😊',
  'Tranquilo! Vou deixar sua vaga guardadinha por uns dias. Qualquer coisa é só mandar mensagem por aqui mesmo',
  'Entendo perfeitamente. Assim que puder, me chama aqui no WhatsApp que a gente encaixa você',
];

const LOST_OBJECTION_FINAL = [
  'Vou ter que deixar pra outra hora, não tá dando certo agora financeiramente 😕',
  'Infelizmente não vai dar pra fechar agora, mas {obg} pela atenção',
  'Vou procurar um lugar que feche com meu convênio mesmo, mas {obg}',
  'Vou pensar mais um pouco, mas acho que não vai rolar por agora',
];

const LOST_AGENT_REPLY = [
  '{first}, sem problema nenhum! Ficamos à disposição aqui no WhatsApp sempre que precisar 😊',
  'Entendo, {first}! Qualquer mudança de ideia, é só chamar por aqui. Um abraço!',
  'Tranquilo! A porta fica sempre aberta pra você. Obrigada por nos procurar 🙂',
];

const URGENCY_MARKERS = [
  'Gente, desculpa incomodar a essa hora, mas acordei com uma dor terrível de dente 😭',
  'Gente, socorro, meu filho tá chorando de dor de dente, oq eu faço?',
  'Oi, será que tem como encaixar rápido? Não aguento mais essa dor',
  'Oi, o dente que fizeram canal aqui voltou a doer forte, virou um desespero',
  'Urgência: caiu um pedaço do meu dente agora e tá sangrando um pouco',
  'Não tô aguentando essa dor, tem alguém que possa me atender ainda hoje?',
  'Meu rosto inchou do lado do dente que tava doendo, isso é grave?',
];

const URGENCY_AGENT_REPLY = [
  '{first}, calma, já vou te ajudar! 😟 Consegue vir até a clínica agora ou daqui a pouco?',
  'Poxa {first}, sinto muito! Vou verificar um horário de urgência agora mesmo, aguenta aí um minutinho',
  '{first}, isso pode ser mais sério, melhor não esperar. Consigo te encaixar em breve, você consegue vir?',
];

const URGENCY_PATIENT_CONFIRM = [
  'Consigo sim, já tô me arrumando pra ir',
  'Consigo, só me fala o horário que eu já saio',
  'Sim, prefiro ir logo, essa dor tá insuportável',
  'Vou aí assim que puder, {obg} por me atender rápido',
];

const URGENCY_AGENT_CONFIRM = [
  '{first}, já te encaixei com {dentist} daqui a pouco. Vem com calma, a gente já vai te acolher aqui ❤️',
  'Prontinho! {dentist} vai te atender assim que chegar. Qualquer coisa me chama por aqui mesmo',
  'Combinado, {first}! Te espero aqui, {dentist} já está {avisado}. Vem direto pra recepção',
];

const WEEKDAYS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function pick(arr: string[]): string {
  return randomEl(arr);
}

function fill(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(v), template);
}

// =====================================================
// CONVERSATION GENERATION
// =====================================================

interface GeneratedConversation {
  messages: Array<{ role: string; content: string; createdAt: Date }>;
  lastMessageAt: Date;
  dealStage: string;
  service: SeedService;
}

function generateRealisticConversation(
  patientName: PatientName,
  dentist: SeedDentist,
  category: 'scheduled' | 'followup' | 'lost' | 'urgent',
  hourBucket: HourBucket,
): GeneratedConversation {
  const service = randomEl(dentist.services);
  const messages: Array<{ role: string; content: string; createdAt: Date }> = [];
  const dentistFemale = dentist.name.startsWith('Dra.');
  const dentistArticle = dentistFemale ? 'a' : 'o';
  const dentistTitle = dentistFemale ? 'Dra.' : 'Dr.';
  const dentistAvisado = dentistFemale ? 'avisada' : 'avisado';

  const currentTime = new Date();
  currentTime.setDate(currentTime.getDate() - randomInt(1, 15));
  currentTime.setHours(hourForBucket(hourBucket), randomInt(0, 59), 0, 0);

  function push(role: string, content: string, minutesForward = 0) {
    currentTime.setMinutes(currentTime.getMinutes() + minutesForward);
    messages.push({ role, content, createdAt: new Date(currentTime) });
  }

  if (category === 'urgent') {
    push('patient', pick(URGENCY_MARKERS));
    push('agent', fill(pick(URGENCY_AGENT_REPLY), { first: patientName.first }), randomInt(1, 4));
    push('patient', fill(pick(URGENCY_PATIENT_CONFIRM), { obg: patientName.obg }), randomInt(2, 8));
    push('agent', fill(pick(URGENCY_AGENT_CONFIRM), { first: patientName.first, dentist: dentist.name, avisado: dentistAvisado }), randomInt(2, 6));
    push('patient', `Muito ${patientName.obg}, já tô indo!`, randomInt(1, 5));
    return { messages, lastMessageAt: new Date(currentTime), dealStage: 'attended', service };
  }

  // Opening
  push('patient', pick(CONVERSATION_STARTERS));
  push('agent', `Oi, ${patientName.first}! 😊 Tudo bem? Que bom que você chamou a gente. Aqui ${dentistArticle} ${dentist.name} cuida de ${dentist.speciality.toLowerCase()}. Como posso te ajudar hoje?`, randomInt(3, 20));

  const priceQuestion = fill(pick(PRICE_QUESTIONS), { service: service.name.toLowerCase() });
  push('patient', priceQuestion.charAt(0).toUpperCase() + priceQuestion.slice(1), randomInt(2, 15));
  push('agent', pick(priceReplyTemplates(patientName.first, service, dentistArticle, dentistTitle)), randomInt(4, 25));

  if (category === 'lost') {
    const objectionPool = [...OBJECTIONS_PRICE, ...OBJECTIONS_INSURANCE, ...OBJECTIONS_FEAR];
    push('patient', pick(objectionPool), randomInt(3, 30));
    push('agent', `Entendo, ${patientName.first}. Se precisar de algo é só chamar, tá aqui na clínica ou aqui pelo WhatsApp mesmo 🙂`, randomInt(3, 15));
    push('patient', fill(pick(LOST_OBJECTION_FINAL), { obg: patientName.obg }), randomInt(10, 120));
    push('agent', fill(pick(LOST_AGENT_REPLY), { first: patientName.first }), randomInt(2, 10));
    return { messages, lastMessageAt: new Date(currentTime), dealStage: 'lost', service };
  }

  if (category === 'followup') {
    push('patient', pick([...OBJECTIONS_PRICE, ...OBJECTIONS_SCHEDULE]), randomInt(3, 20));
    push('agent', `Sem problema, ${patientName.first}! Fico no aguardo aqui pelo WhatsApp mesmo, sem compromisso nenhum 😊`, randomInt(2, 10));
    // Time gap simulating days passing before follow-up
    currentTime.setDate(currentTime.getDate() + randomInt(2, 6));
    push('agent', fill(pick(FOLLOWUP_AGENT_REOPEN), { first: patientName.first, service: service.name.toLowerCase() }), 0);
    push('patient', fill(pick(FOLLOWUP_PATIENT_STALL), { obg: patientName.obg }), randomInt(15, 90));
    push('agent', fill(pick(FOLLOWUP_AGENT_CLOSE), { first: patientName.first }), randomInt(2, 10));
    return { messages, lastMessageAt: new Date(currentTime), dealStage: 'qualified', service };
  }

  // scheduled
  push('patient', pick(OBJECTIONS_SCHEDULE.concat(['Certo, faz sentido! Vamos marcar então'])), randomInt(3, 20));

  const day1 = pick(WEEKDAYS);
  let day2 = pick(WEEKDAYS);
  while (day2 === day1) day2 = pick(WEEKDAYS);
  push('agent', fill(pick(SCHEDULING_QUESTIONS), { day: day1, day2 }), randomInt(2, 10));
  push('patient', fill(pick(SCHEDULING_PATIENT_REPLIES), { day: day1 }), randomInt(2, 15));

  push('agent', pick(FULL_NAME_ASK), randomInt(1, 8));
  push('patient', fill(pick(NAME_CONFIRM_REPLIES), { name: patientName.full }), randomInt(1, 6));

  const confirmTime = `${randomInt(8, 18)}h${randomEl(['', '30'])}`;
  push('agent', fill(pick(CONFIRMATION_TEMPLATES), {
    first: patientName.first,
    day: day1,
    time: confirmTime,
    dentist: dentist.name,
    service: service.name,
  }), randomInt(2, 10));
  push('patient', fill(pick(CLOSING_CONFIRMED), { obg: patientName.obg }), randomInt(1, 8));

  return { messages, lastMessageAt: new Date(currentTime), dealStage: 'scheduled', service };
}

// =====================================================
// MAIN SEED FUNCTION
// =====================================================

async function seedMasterClinic() {
  try {
    const [clinic] = await db.select().from(schema.clinics).where(eq(schema.clinics.name, 'Clinica Master')).limit(1);

    if (!clinic) {
      console.error('❌ Clínica Master não encontrada. Crie primeiro.');
      process.exit(1);
    }

    const ctx: SeedContext = { clinicId: clinic.id, dentists: [] };

    console.log('🦷 Iniciando seed de dados realistas para Clínica Master...\n');

    // ========== 0. Cleanup previous seed (scoped to this clinic only) ==========
    console.log('🧹 Limpando dados anteriores da Clínica Master...');

    const existingProfessionals = await db
      .select({ id: schema.professionals.id })
      .from(schema.professionals)
      .where(eq(schema.professionals.clinicId, ctx.clinicId));
    const professionalIds = existingProfessionals.map((p) => p.id);

    const existingServices = await db
      .select({ id: schema.services.id })
      .from(schema.services)
      .where(eq(schema.services.clinicId, ctx.clinicId));
    const serviceIds = existingServices.map((s) => s.id);

    await db.delete(schema.appointments).where(eq(schema.appointments.clinicId, ctx.clinicId));
    await db.delete(schema.messages).where(eq(schema.messages.clinicId, ctx.clinicId));
    await db.delete(schema.conversations).where(eq(schema.conversations.clinicId, ctx.clinicId));
    await db.delete(schema.deals).where(eq(schema.deals.clinicId, ctx.clinicId));
    await db.delete(schema.patients).where(eq(schema.patients.clinicId, ctx.clinicId));
    for (const profId of professionalIds) {
      await db.delete(schema.professionalServices).where(eq(schema.professionalServices.professionalId, profId));
    }
    await db.delete(schema.services).where(eq(schema.services.clinicId, ctx.clinicId));
    await db.delete(schema.professionals).where(eq(schema.professionals.clinicId, ctx.clinicId));

    console.log(`✅ Removidos: ${professionalIds.length} profissionais, ${serviceIds.length} serviços e leads antigos\n`);

    // ========== 1. Create Dentists ==========
    console.log('📋 Criando dentistas...');
    const dentistsData = [
      {
        name: 'Dra. Mariana Costa',
        speciality: 'Ortodontia e Estética',
        services: [
          { name: 'Avaliação Ortodôntica', priceCents: 15000, durationMin: 40 },
          { name: 'Aparelho Fixo Metálico', priceCents: 380000, durationMin: 60 },
          { name: 'Aparelho Estético (Invisalign)', priceCents: 650000, durationMin: 60 },
          { name: 'Clareamento a Laser', priceCents: 70000, durationMin: 50 },
          { name: 'Facetas de Resina', priceCents: 120000, durationMin: 90 },
        ],
      },
      {
        name: 'Dr. Rafael Prado',
        speciality: 'Implantodontia e Cirurgia',
        services: [
          { name: 'Avaliação para Implante', priceCents: 15000, durationMin: 40 },
          { name: 'Implante Dentário Unitário', priceCents: 350000, durationMin: 90 },
          { name: 'Extração de Siso', priceCents: 45000, durationMin: 45 },
          { name: 'Enxerto Ósseo', priceCents: 280000, durationMin: 90 },
          { name: 'Prótese sobre Implante', priceCents: 220000, durationMin: 60 },
        ],
      },
      {
        name: 'Dra. Camila Alves',
        speciality: 'Odontopediatria e Clínica Geral',
        services: [
          { name: 'Limpeza e Profilaxia', priceCents: 15000, durationMin: 40 },
          { name: 'Restauração em Resina', priceCents: 25000, durationMin: 50 },
          { name: 'Tratamento de Canal', priceCents: 90000, durationMin: 90 },
          { name: 'Avaliação Infantil', priceCents: 12000, durationMin: 30 },
          { name: 'Aplicação de Flúor', priceCents: 8000, durationMin: 20 },
        ],
      },
    ];

    for (const dData of dentistsData) {
      const prof = firstOrThrow(
        await db
          .insert(schema.professionals)
          .values({
            clinicId: ctx.clinicId,
            name: dData.name,
            speciality: dData.speciality,
            active: true,
          })
          .returning(),
      );

      const dentist: SeedDentist = { id: prof.id, name: prof.name, speciality: prof.speciality!, services: [] };

      for (const sData of dData.services) {
        const service = firstOrThrow(
          await db
            .insert(schema.services)
            .values({
              clinicId: ctx.clinicId,
              name: sData.name,
              durationMin: sData.durationMin,
              priceCents: sData.priceCents,
            })
            .returning(),
        );

        await db.insert(schema.professionalServices).values({
          professionalId: prof.id,
          serviceId: service.id,
        });

        dentist.services.push({ id: service.id, name: service.name, priceCents: service.priceCents! });
      }

      ctx.dentists.push(dentist);
    }
    console.log(`✅ ${ctx.dentists.length} dentistas criados com ${ctx.dentists.reduce((n, d) => n + d.services.length, 0)} serviços no catálogo\n`);

    // ========== 2. Create 50 Leads with Realistic Conversations ==========
    console.log('👥 Criando 50 leads com histórico realista...');

    const leadCategories = [
      ...Array(20).fill('scheduled'),
      ...Array(15).fill('followup'),
      ...Array(10).fill('lost'),
      ...Array(5).fill('urgent'),
    ] as Array<'scheduled' | 'followup' | 'lost' | 'urgent'>;

    const hourPlan = buildHourPlan(leadCategories.length);

    for (let i = 0; i < leadCategories.length; i++) {
      const patientName = generateName();
      const phone = generatePhone();
      const category = leadCategories[i] as (typeof leadCategories)[number];
      const dentist = randomEl(ctx.dentists);
      const hourBucket = hourPlan[i] as HourBucket;

      const patient = firstOrThrow(
        await db
          .insert(schema.patients)
          .values({
            clinicId: ctx.clinicId,
            name: patientName.full,
            phone,
            insurance: randomEl([null, null, 'Particular', 'Bradesco Saúde', 'Unimed', 'Amil']),
            tags: [category],
            lgpdConsent: true,
          })
          .returning(),
      );

      const convData = generateRealisticConversation(patientName, dentist, category, hourBucket);

      const negotiationFactor = randomEl([0.9, 0.95, 1, 1, 1.05]);
      const dealValueCents = Math.round(convData.service.priceCents * negotiationFactor);

      await db.insert(schema.deals).values({
        clinicId: ctx.clinicId,
        patientId: patient.id,
        serviceId: convData.service.id,
        stage: convData.dealStage,
        valueCents: dealValueCents,
        notes: `Lead via WhatsApp - ${category}`,
      });

      const conversation = firstOrThrow(
        await db
          .insert(schema.conversations)
          .values({
            clinicId: ctx.clinicId,
            patientId: patient.id,
            externalId: phone,
            status: category === 'lost' ? 'closed' : 'agent_active',
            lastMessageAt: convData.lastMessageAt,
          })
          .returning(),
      );

      for (const msg of convData.messages) {
        await db.insert(schema.messages).values({
          clinicId: ctx.clinicId,
          conversationId: conversation.id,
          role: msg.role as any,
          content: msg.content,
          createdAt: msg.createdAt,
        });
      }

      if (convData.dealStage === 'scheduled') {
        const appointmentDate = new Date();
        appointmentDate.setDate(appointmentDate.getDate() + randomInt(1, 10));
        appointmentDate.setHours(randomInt(8, 18), randomEl([0, 30]), 0, 0);

        await db.insert(schema.appointments).values({
          clinicId: ctx.clinicId,
          patientId: patient.id,
          professionalId: dentist.id,
          serviceId: convData.service.id,
          startsAt: appointmentDate,
          endsAt: new Date(appointmentDate.getTime() + 60 * 60000),
          status: 'scheduled',
        });
      }

      if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${leadCategories.length}...\n`);
    }
    console.log(`✅ ${leadCategories.length} leads com conversas criados\n`);

    console.log('🎉 Seed concluído com sucesso!');
    console.log(`📊 Resumo:`);
    console.log(`  • Clínica: Clinica Master`);
    console.log(`  • Dentistas: ${ctx.dentists.length}`);
    console.log(`  • Leads: ${leadCategories.length}`);
    console.log(`  • Distribuição: 20 agendadas, 15 em follow-up, 10 perdidas, 5 urgências`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Erro no seed:', err);
    process.exit(1);
  }
}

seedMasterClinic();

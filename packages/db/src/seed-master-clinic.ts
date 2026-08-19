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
  const dawnCount = Math.max(1, Math.round(total * 0.08));
  const earlyCount = Math.max(1, Math.round(total * 0.06));
  const eveningCount = Math.max(1, Math.round(total * 0.14));
  const businessCount = total - dawnCount - earlyCount - eveningCount;
  const plan: HourBucket[] = [
    ...Array(dawnCount).fill('dawn'),
    ...Array(earlyCount).fill('earlyMorning'),
    ...Array(eveningCount).fill('evening'),
    ...Array(Math.max(0, businessCount)).fill('business'),
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

const NOVO_AGENT_REPLIES = [
  'Oi! 😊 Tudo bem? Que bom falar com você! Já vou te ajudar, só um instantinho.',
  'Olá! Seja bem-vindo(a) 🙌 Já te retorno com todas as informações.',
  'Oi, boa tarde! Claro, posso te ajudar sim. Me dá um minutinho que já te explico tudo.',
  'Olá! Ótimo te ter por aqui 😊 Deixa eu buscar os detalhes certinhos pra você.',
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

const FIRST_VISIT_ASK = [
  'Só confirmando: você já é paciente da nossa clínica ou seria sua primeira vez por aqui?',
  'Você já se consultou com a gente antes ou vai ser sua primeira visita?',
  'Pra eu já preparar seu cadastro certinho: primeira vez aqui na clínica?',
];

const FIRST_VISIT_REPLY_YES = [
  'Sim, primeira vez mesmo',
  'É minha primeira vez aí, sim',
  'Nunca fui, seria a primeira vez',
];

const FIRST_VISIT_REPLY_NO = [
  'Não, já sou paciente de vocês',
  'Já me consultei aí antes',
  'Não, já sou cliente antigo',
];

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

const OBJECTIONS_SCHEDULE = [
  'Só posso ir final de semana, vocês abrem sábado?',
  'Minha agenda tá impossível essa semana, tem horário mais pra frente?',
  'Só consigo depois das 18h, vocês têm vaga nesse horário?',
];

const TRIAGEM_STALL_AGENT = [
  'Sem problema nenhum, {first}! Fico aqui no WhatsApp mesmo, é só me chamar quando quiser fechar o horário 😊',
  'Tranquilo, {first}! Vou deixar seus dados aqui guardadinhos, qualquer coisa retomamos por aqui.',
  'Entendo perfeitamente! Fico no aguardo aqui, sem compromisso nenhum.',
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

const REMINDER_AGENT_ASK = [
  'Oi {first}! Passando aqui pra confirmar sua consulta amanhã às {time} com {dentist} para {service}. Você confirma presença? 😊',
  '{first}, tudo bem? Lembrete rapidinho: amanhã às {time} é sua consulta com {dentist}. Confirma que vem?',
  'Oi {first}! Sua consulta com {dentist} tá marcada pra amanhã, {time}. Posso confirmar sua presença?',
];

const REMINDER_PATIENT_YES = [
  'Sim, confirmado! Vou estar aí',
  'Confirmado, até amanhã!',
  'Sim, vou comparecer sim',
  'Pode confirmar, tô indo',
];

const REMINDER_AGENT_THANKS = [
  'Perfeito, {first}! Te espero aqui então 😊',
  'Ótimo, obrigada por confirmar! Até amanhã',
  'Show, anotado aqui. Nos vemos amanhã!',
];

const NOSHOW_AGENT_REACHOUT = [
  'Oi {first}, tudo bem? Sentimos sua falta na consulta de {day} com {dentist} 😕 Quer remarcar para outro dia?',
  '{first}, notamos que você não conseguiu vir na consulta marcada. Ficou tudo bem? Posso te encaixar em outro horário.',
  'Oi {first}! Vimos que faltou na consulta com {dentist}. Sem problema, quer que eu já veja um novo horário pra você?',
];

const NOSHOW_PATIENT_REPLY = [
  'Desculpa, surgiu um imprevisto de última hora! Quero remarcar sim',
  'Foi mal, esqueci completamente 😔 Pode ser semana que vem?',
  'Tive um imprevisto no trabalho, mil desculpas. Consigo remarcar?',
  'Passei mal naquele dia, não consegui avisar a tempo. Vamos remarcar?',
];

const NOSHOW_AGENT_CLOSE = [
  'Sem problema, {first}! Vou deixar em aberto aqui, é só me chamar quando quiser escolher um novo dia 😊',
  'Tranquilo! Fico no aguardo por aqui pra remarcarmos assim que puder.',
  'Entendido! Quando puder, me chama por aqui que já vejo um novo horário com {dentist}.',
];

const WEEKDAYS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function pick(arr: string[]): string {
  return randomEl(arr);
}

function fill(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(v), template);
}

// =====================================================
// QUALIFICATION DATA (mirrors what the WhatsApp AI agent
// would extract and store as structured CRM fields)
// =====================================================

const COMPLAINT_PHRASES: Record<string, string[]> = {
  ortho: ['desconforto com o alinhamento dos dentes', 'sensação de dentes tortos incomodando na mordida', 'vontade de melhorar o sorriso antes de um evento'],
  implant: ['dor no local de um dente que caiu', 'dificuldade para mastigar de um lado', 'desconforto com uma prótese antiga'],
  general: ['dor no dente do siso há alguns dias', 'sensibilidade ao comer coisas geladas', 'um dente sensível há algumas semanas', 'desconforto leve ao mastigar'],
};

function complaintCategoryFor(dentist: SeedDentist): keyof typeof COMPLAINT_PHRASES {
  if (dentist.speciality.toLowerCase().includes('ortodontia')) return 'ortho';
  if (dentist.speciality.toLowerCase().includes('implant')) return 'implant';
  return 'general';
}

function buildComplaintSummary(dentist: SeedDentist): string {
  const pool = COMPLAINT_PHRASES[complaintCategoryFor(dentist)]!;
  const phrase = pick(pool);
  const days = randomInt(1, 10);
  return `Paciente relatou ${phrase} há ${days} dia${days > 1 ? 's' : ''}.`;
}

function urgencyFor(service: SeedService): 'alta' | 'media' | 'baixa' {
  const urgentServices = ['Extração de Siso', 'Tratamento de Canal', 'Enxerto Ósseo'];
  if (urgentServices.includes(service.name)) return randomEl(['alta', 'alta', 'media'] as const);
  const roll = Math.random();
  if (roll < 0.12) return 'alta';
  if (roll < 0.45) return 'media';
  return 'baixa';
}

// =====================================================
// CONVERSATION GENERATION
// =====================================================

type FunnelCategory = 'lead_novo' | 'triagem' | 'agendado' | 'presenca_confirmada' | 'faltou_remarcar';

interface GeneratedConversation {
  messages: Array<{ role: string; content: string; createdAt: Date }>;
  lastMessageAt: Date;
  dealStage: FunnelCategory;
  service: SeedService;
  qualified: boolean; // whether triage data (name/first-visit/complaint) was actually collected
  appointmentDate: Date | null;
  appointmentStatus: 'scheduled' | 'confirmed' | 'no_show' | null;
}

function generateRealisticConversation(
  patientName: PatientName,
  dentist: SeedDentist,
  category: FunnelCategory,
  hourBucket: HourBucket,
): GeneratedConversation {
  const service = randomEl(dentist.services);
  const messages: Array<{ role: string; content: string; createdAt: Date }> = [];
  const dentistFemale = dentist.name.startsWith('Dra.');
  const dentistArticle = dentistFemale ? 'a' : 'o';
  const dentistTitle = dentistFemale ? 'Dra.' : 'Dr.';

  const currentTime = new Date();
  currentTime.setDate(currentTime.getDate() - randomInt(1, 15));
  currentTime.setHours(hourForBucket(hourBucket), randomInt(0, 59), 0, 0);

  function push(role: string, content: string, minutesForward = 0) {
    currentTime.setMinutes(currentTime.getMinutes() + minutesForward);
    messages.push({ role, content, createdAt: new Date(currentTime) });
  }

  // Opening (shared by every category)
  push('patient', pick(CONVERSATION_STARTERS));

  if (category === 'lead_novo') {
    push('agent', pick(NOVO_AGENT_REPLIES), randomInt(1, 6));
    return {
      messages,
      lastMessageAt: new Date(currentTime),
      dealStage: 'lead_novo',
      service,
      qualified: false,
      appointmentDate: null,
      appointmentStatus: null,
    };
  }

  push('agent', `Oi, ${patientName.first}! 😊 Tudo bem? Que bom que você chamou a gente. Aqui ${dentistArticle} ${dentist.name} cuida de ${dentist.speciality.toLowerCase()}. Como posso te ajudar hoje?`, randomInt(3, 20));

  const priceQuestion = fill(pick(PRICE_QUESTIONS), { service: service.name.toLowerCase() });
  push('patient', priceQuestion.charAt(0).toUpperCase() + priceQuestion.slice(1), randomInt(2, 15));
  push('agent', pick(priceReplyTemplates(patientName.first, service, dentistArticle, dentistTitle)), randomInt(4, 25));

  // Triage: first-visit question, always asked once we're past "lead novo"
  const isFirstVisit = Math.random() < 0.6;
  push('agent', pick(FIRST_VISIT_ASK), randomInt(2, 12));
  push('patient', pick(isFirstVisit ? FIRST_VISIT_REPLY_YES : FIRST_VISIT_REPLY_NO), randomInt(1, 8));

  if (category === 'triagem') {
    const objectionPool = [...OBJECTIONS_PRICE, ...OBJECTIONS_INSURANCE, ...OBJECTIONS_SCHEDULE];
    push('patient', pick(objectionPool), randomInt(3, 30));
    push('agent', fill(pick(TRIAGEM_STALL_AGENT), { first: patientName.first }), randomInt(2, 10));
    return {
      messages,
      lastMessageAt: new Date(currentTime),
      dealStage: 'triagem',
      service,
      qualified: true,
      appointmentDate: null,
      appointmentStatus: null,
    };
  }

  // agendado / presenca_confirmada / faltou_remarcar: booking happens
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

  const appointmentDate = new Date();
  appointmentDate.setDate(appointmentDate.getDate() + randomInt(2, 12));
  appointmentDate.setHours(randomInt(8, 18), randomEl([0, 30]), 0, 0);

  if (category === 'agendado') {
    return {
      messages,
      lastMessageAt: new Date(currentTime),
      dealStage: 'agendado',
      service,
      qualified: true,
      appointmentDate,
      appointmentStatus: 'scheduled',
    };
  }

  if (category === 'presenca_confirmada') {
    // Time gap: the day before the appointment, AI sends a reminder
    currentTime.setDate(currentTime.getDate() + randomInt(1, 5));
    push('agent', fill(pick(REMINDER_AGENT_ASK), { first: patientName.first, time: confirmTime, dentist: dentist.name, service: service.name }), 0);
    push('patient', pick(REMINDER_PATIENT_YES), randomInt(3, 40));
    push('agent', fill(pick(REMINDER_AGENT_THANKS), { first: patientName.first }), randomInt(1, 6));
    return {
      messages,
      lastMessageAt: new Date(currentTime),
      dealStage: 'presenca_confirmada',
      service,
      qualified: true,
      appointmentDate,
      appointmentStatus: 'confirmed',
    };
  }

  // faltou_remarcar: appointment date already passed, patient didn't show
  const pastAppointmentDate = new Date();
  pastAppointmentDate.setDate(pastAppointmentDate.getDate() - randomInt(1, 5));
  pastAppointmentDate.setHours(randomInt(8, 18), randomEl([0, 30]), 0, 0);

  currentTime.setDate(currentTime.getDate() + randomInt(1, 3));
  push('agent', fill(pick(NOSHOW_AGENT_REACHOUT), { first: patientName.first, day: day1, dentist: dentist.name }), 0);
  push('patient', pick(NOSHOW_PATIENT_REPLY), randomInt(5, 60));
  push('agent', fill(pick(NOSHOW_AGENT_CLOSE), { first: patientName.first, dentist: dentist.name }), randomInt(2, 10));

  return {
    messages,
    lastMessageAt: new Date(currentTime),
    dealStage: 'faltou_remarcar',
    service,
    qualified: true,
    appointmentDate: pastAppointmentDate,
    appointmentStatus: 'no_show',
  };
}

// =====================================================
// MAIN SEED FUNCTION
// =====================================================

async function seedMasterClinic() {
  try {
    let [clinic] = await db.select().from(schema.clinics).where(eq(schema.clinics.slug, 'master-clinic')).limit(1);
    if (!clinic) {
      [clinic] = await db.select().from(schema.clinics).where(eq(schema.clinics.name, 'Clinica Master')).limit(1);
    }

    if (!clinic) {
      console.error('❌ Clínica de teste não encontrada (slug "master-clinic"). Crie primeiro.');
      process.exit(1);
    }

    const ctx: SeedContext = { clinicId: clinic.id, dentists: [] };

    console.log(`🦷 Iniciando seed de dados realistas para "${clinic.name}"...\n`);

    // ========== 0. Cleanup previous seed (scoped to this clinic only) ==========
    console.log('🧹 Limpando dados anteriores...');

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

    // ========== 2. Create leads distributed across the 5-stage funnel ==========
    console.log('👥 Criando leads com histórico realista distribuídos pelo funil...');

    const leadCategories = [
      ...Array(8).fill('lead_novo'),
      ...Array(10).fill('triagem'),
      ...Array(12).fill('agendado'),
      ...Array(6).fill('presenca_confirmada'),
      ...Array(4).fill('faltou_remarcar'),
    ] as FunnelCategory[];

    const hourPlan = buildHourPlan(leadCategories.length);

    for (let i = 0; i < leadCategories.length; i++) {
      const patientName = generateName();
      const phone = generatePhone();
      const category = leadCategories[i] as FunnelCategory;
      const dentist = randomEl(ctx.dentists);
      const hourBucket = hourPlan[i] as HourBucket;

      const convData = generateRealisticConversation(patientName, dentist, category, hourBucket);

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
            contactReason: convData.qualified ? convData.service.name : null,
            firstVisit: convData.qualified ? Math.random() < 0.6 : null,
            urgencyLevel: convData.qualified ? urgencyFor(convData.service) : null,
            complaintSummary: convData.qualified ? buildComplaintSummary(dentist) : null,
          })
          .returning(),
      );

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
            status: category === 'lead_novo' ? 'agent_active' : 'agent_active',
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

      if (convData.appointmentDate && convData.appointmentStatus) {
        await db.insert(schema.appointments).values({
          clinicId: ctx.clinicId,
          patientId: patient.id,
          professionalId: dentist.id,
          serviceId: convData.service.id,
          startsAt: convData.appointmentDate,
          endsAt: new Date(convData.appointmentDate.getTime() + 60 * 60000),
          status: convData.appointmentStatus,
        });
      }

      if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${leadCategories.length}...\n`);
    }
    console.log(`✅ ${leadCategories.length} leads com conversas criados\n`);

    console.log('🎉 Seed concluído com sucesso!');
    console.log(`📊 Resumo:`);
    console.log(`  • Clínica: ${clinic.name}`);
    console.log(`  • Dentistas: ${ctx.dentists.length}`);
    console.log(`  • Leads: ${leadCategories.length}`);
    console.log(`  • Funil: 8 Lead Novo, 10 Triagem Concluída, 12 Agendamento Realizado, 6 Presença Confirmada, 4 Faltou/Remarcar`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Erro no seed:', err);
    process.exit(1);
  }
}

seedMasterClinic();

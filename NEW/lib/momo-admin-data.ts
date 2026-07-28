export type PackageType = 'custom' | 'digital' | 'vip2' | 'vip4'

export type PaymentMethod = 'bit' | 'paybox' | 'transfer' | 'cash' | 'other'

export type MessageStatus = 'delivered' | 'pending' | 'failed'

export interface Coupon {
  id: string
  code: string
  limit: number
  used: number
}

export interface ClientFeatures {
  whatsappRound1: boolean
  whatsappRound2: boolean
  quickReplyButtons: boolean
  calls1: boolean
  calls2: boolean
  calls3: boolean
  calls4: boolean
  eventDayReminder: boolean
  tableNumberWhatsapp: boolean
  tableNumberHostess: boolean
  thankYouMessage: boolean
}

export interface ClientDeal {
  package: PackageType
  marketingSource: string
  amountPaid: number
  paymentMethod: PaymentMethod
  adminNotes: string
}

export interface ClientAnalytics {
  whatsappDelivered: number
  whatsappPending: number
  whatsappFailed: number
  whatsappTotal: number
  callsRound1: number
  callsRound1Total: number
  callsRound2: number
  callsRound2Total: number
}

export interface Client {
  id: string
  partnerA: string
  partnerB: string
  phone: string
  eventName: string
  eventDate: string
  location: string
  etsyOrderId: string
  email: string
  createdAt: string
  username: string
  password: string
  inviteLink: string
  dashboardLink: string
  coupons: Coupon[]
  features: ClientFeatures
  deal: ClientDeal
  analytics: ClientAnalytics
}

export const PACKAGE_LABELS: Record<PackageType, string> = {
  custom: 'התאמה אישית',
  digital: 'דיגיטל',
  vip2: 'VIP 2 סבבים',
  vip4: 'VIP 4 סבבים',
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  bit: 'ביט',
  paybox: 'פייבוקס',
  transfer: 'העברה בנקאית',
  cash: 'מזומן',
  other: 'אחר',
}

function makeFeatures(overrides: Partial<ClientFeatures> = {}): ClientFeatures {
  return {
    whatsappRound1: true,
    whatsappRound2: false,
    quickReplyButtons: false,
    calls1: false,
    calls2: false,
    calls3: false,
    calls4: false,
    eventDayReminder: true,
    tableNumberWhatsapp: true,
    tableNumberHostess: false,
    thankYouMessage: false,
    ...overrides,
  }
}

export const CLIENTS: Client[] = [
  {
    id: 'c1',
    partnerA: 'עמית',
    partnerB: 'לירז',
    phone: '0524253791',
    eventName: 'החתונה של עמית ולירז',
    eventDate: '2026-09-14',
    location: 'אולמי הגן הקסום, ראשון לציון',
    etsyOrderId: '3948571022',
    email: 'amit.liraz@gmail.com',
    createdAt: '2026-06-02',
    username: 'amit_liraz',
    password: 'momo-8241',
    inviteLink: 'https://momo.co.il/i/amit-liraz',
    dashboardLink: 'https://momo.co.il/d/amit-liraz',
    coupons: [
      { id: 'cp1', code: 'WA-AMIT-300', limit: 300, used: 214 },
      { id: 'cp2', code: 'WA-AMIT-100', limit: 100, used: 22 },
    ],
    features: makeFeatures({ whatsappRound2: true, quickReplyButtons: true, calls1: true }),
    deal: {
      package: 'vip2',
      marketingSource: 'אינסטגרם',
      amountPaid: 120,
      paymentMethod: 'bit',
      adminNotes: 'לקוחה חזרה מהמלצה, ביקשה כפתורים מהירים.',
    },
    analytics: {
      whatsappDelivered: 236,
      whatsappPending: 14,
      whatsappFailed: 8,
      whatsappTotal: 258,
      callsRound1: 42,
      callsRound1Total: 58,
      callsRound2: 12,
      callsRound2Total: 58,
    },
  },
  {
    id: 'c2',
    partnerA: 'נועה',
    partnerB: 'דניאל',
    phone: '0501234567',
    eventName: 'החתונה של נועה ודניאל',
    eventDate: '2026-08-03',
    location: 'חוות רונית, בנימינה',
    etsyOrderId: '3948120988',
    email: 'noa.daniel@gmail.com',
    createdAt: '2026-05-18',
    username: 'noa_daniel',
    password: 'momo-5573',
    inviteLink: 'https://momo.co.il/i/noa-daniel',
    dashboardLink: 'https://momo.co.il/d/noa-daniel',
    coupons: [{ id: 'cp3', code: 'WA-NOA-250', limit: 250, used: 250 }],
    features: makeFeatures({ whatsappRound2: true, calls1: true, calls2: true, thankYouMessage: true }),
    deal: {
      package: 'vip4',
      marketingSource: 'המלצה מחברה',
      amountPaid: 180,
      paymentMethod: 'paybox',
      adminNotes: '',
    },
    analytics: {
      whatsappDelivered: 250,
      whatsappPending: 0,
      whatsappFailed: 3,
      whatsappTotal: 253,
      callsRound1: 61,
      callsRound1Total: 61,
      callsRound2: 40,
      callsRound2Total: 61,
    },
  },
  {
    id: 'c3',
    partnerA: 'שיר',
    partnerB: 'איתי',
    phone: '0547778812',
    eventName: 'החתונה של שיר ואיתי',
    eventDate: '2026-10-22',
    location: 'טי או, תל אביב',
    etsyOrderId: '3951002347',
    email: 'shir.itay@gmail.com',
    createdAt: '2026-06-20',
    username: 'shir_itay',
    password: 'momo-9012',
    inviteLink: 'https://momo.co.il/i/shir-itay',
    dashboardLink: 'https://momo.co.il/d/shir-itay',
    coupons: [],
    features: makeFeatures({ whatsappRound1: true }),
    deal: {
      package: 'digital',
      marketingSource: 'חיפוש בגוגל',
      amountPaid: 0,
      paymentMethod: 'other',
      adminNotes: 'עדיין לא שילמה — בתקופת ניסיון.',
    },
    analytics: {
      whatsappDelivered: 48,
      whatsappPending: 6,
      whatsappFailed: 1,
      whatsappTotal: 55,
      callsRound1: 0,
      callsRound1Total: 0,
      callsRound2: 0,
      callsRound2Total: 0,
    },
  },
  {
    id: 'c4',
    partnerA: 'מאיה',
    partnerB: 'תום',
    phone: '0523339988',
    eventName: 'החתונה של מאיה ותום',
    eventDate: '2026-07-29',
    location: 'אחוזת נוף, כרמיאל',
    etsyOrderId: '3949887654',
    email: 'maya.tom@gmail.com',
    createdAt: '2026-04-30',
    username: 'maya_tom',
    password: 'momo-3320',
    inviteLink: 'https://momo.co.il/i/maya-tom',
    dashboardLink: 'https://momo.co.il/d/maya-tom',
    coupons: [{ id: 'cp4', code: 'WA-MAYA-400', limit: 400, used: 318 }],
    features: makeFeatures({ whatsappRound2: true, quickReplyButtons: true, calls1: true, calls2: true, eventDayReminder: true, tableNumberHostess: true }),
    deal: {
      package: 'vip4',
      marketingSource: 'טיקטוק',
      amountPaid: 180,
      paymentMethod: 'transfer',
      adminNotes: 'אירוע גדול (400 מוזמנים).',
    },
    analytics: {
      whatsappDelivered: 372,
      whatsappPending: 18,
      whatsappFailed: 10,
      whatsappTotal: 400,
      callsRound1: 88,
      callsRound1Total: 120,
      callsRound2: 55,
      callsRound2Total: 120,
    },
  },
]

export function buildCredentialsMessage(client: Client) {
  return [
    `היי ${client.partnerA} ו${client.partnerB}! 🎉`,
    `הנה פרטי הכניסה למערכת מומו שלכם:`,
    ``,
    `שם משתמש: ${client.username}`,
    `סיסמה: ${client.password}`,
    ``,
    `קישור לדשבורד: ${client.dashboardLink}`,
    `קישור להזמנה: ${client.inviteLink}`,
    ``,
    `כל שאלה — אנחנו כאן בשבילכם 💌`,
  ].join('\n')
}

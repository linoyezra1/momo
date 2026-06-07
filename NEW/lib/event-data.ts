export type TimelineItem = {
  time: string
  title: string
}

export type EventData = {
  event_type: string
  host_names: string
  intro_text: string
  celebration_text: string
  event_date_formatted: string
  event_time: string
  countdown_target_date: string
  images: {
    hero_bg: string
    countdown_bg: string
    rsvp_bg: string
    timeline_banner: string
    venue_banner: string
    accommodation_banner: string
  }
  timeline: TimelineItem[]
  venue: {
    name: string
    description: string
    address: string
    maps_link: string
  }
  details: {
    dress_code: string
    transportation: string
    accommodation_title: string
    accommodation_subtitle: string
    accommodation_body: string
  }
  rsvp_settings: {
    deadline_text: string
    registry_link: string
  }
}

export const eventData: EventData = {
  event_type: "wedding",
  host_names: "Bella & Mark",
  intro_text: "Together with their families",
  celebration_text: "Invite you to their wedding celebration",
  event_date_formatted: "Saturday, July 22, 2027",
  event_time: "at 3:30 pm",
  countdown_target_date: "2027-07-22T15:30:00",

  images: {
    hero_bg: "/images/floral-bg.png",
    countdown_bg: "/images/coral-floral-bg.png",
    rsvp_bg: "/images/pink-sprig-bg.png",
    timeline_banner: "/images/venue.png",
    venue_banner: "/images/venue.png",
    accommodation_banner: "/images/suite.png",
  },

  timeline: [
    { time: "3:30 PM", title: "Wedding Ceremony" },
    { time: "4:30 PM", title: "Cocktail Hour" },
    { time: "5:00 PM", title: "Photo Session" },
    { time: "6:30 PM", title: "Dinner Reception" },
    { time: "8:00 PM", title: "Dance Party" },
  ],

  venue: {
    name: "Oheka Castle",
    description:
      "Experience a real-life fairytale at this iconic French-style château, nestled on Long Island's gold coast.",
    address: "Long Island, NY",
    maps_link: "https://share.google/eRdAfvIJKFGNwVsok",
  },

  details: {
    dress_code:
      "Semi-formal and elegant. Feel free to add a touch of pastel to match our theme.",
    transportation:
      "Shuttles will be available to transport guests from the ceremony to the reception. Shuttles will depart right after the ceremony.",
    accommodation_title: "Stay at Oheka Castle",
    accommodation_subtitle:
      "Accommodation for up to 42 guests. Elegant, luxury suites. Rates from $250 per night.",
    accommodation_body:
      "For those traveling from afar and wishing to stay overnight, there is a Marriott Hotel located just a 5-minute drive from the wedding reception venue.",
  },

  rsvp_settings: {
    deadline_text: "by July 15th, 2026",
    registry_link: "https://www.zola.com/registry/example",
  },
}

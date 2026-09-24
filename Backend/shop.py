"""Shop facts and design defaults, mirrored from the design's data.ts (SHOP, SERVICES, BARBERS, HOURS)."""

SHOP = {
    "name": "Crown Barber Shop",
    "street": "219 Silvercreek Pkwy N",
    "phone_display": "(519) 763-2229",
}

SERVICES = [
    {"id": "classic", "name": "Classic cut", "detail": "Scissor or clipper, finished with a neck shave", "minutes": 30, "price": 31, "category": "cuts"},
    {"id": "fade", "name": "Skin fade", "detail": "Low, mid or high, blended by hand", "minutes": 40, "price": 34, "category": "cuts"},
    {"id": "kids", "name": "Kids cut", "detail": "Under 12, patience included", "minutes": 25, "price": 25, "category": "cuts"},
    {"id": "senior", "name": "Seniors cut", "detail": "65 and over", "minutes": 25, "price": 25, "category": "cuts"},
    {"id": "beard", "name": "Beard trim", "detail": "Shape, line-up and a hot towel", "minutes": 20, "price": 15, "category": "shaves"},
    {"id": "cut-beard", "name": "Cut and beard", "detail": "Any cut with a full beard trim", "minutes": 50, "price": 44, "category": "shaves"},
    {"id": "head", "name": "Head shave", "detail": "Straight razor, lather and hot towel", "minutes": 30, "price": 30, "category": "shaves"},
    {"id": "hot-towel", "name": "Hot towel shave", "detail": "The full old-school face shave", "minutes": 40, "price": 35, "category": "shaves"},
]

BARBERS = [
    {"id": "any", "name": "First available", "note": "Shortest wait"},
    {
        "id": "tania",
        "name": "Tania",
        "note": "Named in more reviews than anyone",
        "role": "Barber",
        "bio": "Tania cuts at Crown on Silvercreek Parkway, and plenty of regulars come in asking for her by name. Sit down, tell her what you're after, and she'll take it from there.",
    },
]

# Index 0 = Sunday. Ranges in minutes after midnight, Toronto time.
HOURS = [
    [],
    [],
    [[600, 840], [900, 1080]],
    [[600, 840], [900, 1080]],
    [[600, 840], [900, 1140]],
    [[600, 840], [900, 1140]],
    [[540, 840]],
]

# Design sample data (store.ts samplePhotos / sampleBookings / sampleMessages).
SAMPLE_PHOTO_URL = "https://images.unsplash.com/photo-{}?w=1100&q=75&auto=format&fit=crop"
SAMPLE_PHOTOS = [
    ("1648221122323-572c13a31663", "Skin fade, blended by hand", "fade", True),
    ("1582771498000-8ad44e6c84db", "Classic pompadour", "classic", True),
    ("1599011176306-4a96f1516d4d", "Full beard, shaped with scissors", "beard", True),
    ("1640301133543-41fe25ad6450", "Short crop with a sharp line-up", "classic", True),
    ("1567894340315-735d7c361db0", "Taper with curls left on top", "fade", True),
    ("1593702275687-f8b402bf1fb5", "Mid fade, textured top", "fade", False),
    ("1701885183616-cf00e2db1a3b", "Scissor over comb", "classic", False),
    ("1630827020718-3433092696e7", "Beard shape-up", "beard", False),
    ("1568339434343-2a640a1a9946", "Fade with a hard-part design", "fade", False),
    ("1578390432942-d323db577792", "French crop", "classic", False),
    ("1635273051839-003bf06a8751", "Clipper work on the sides", "classic", False),
    ("1599834562135-b6fc90e642ca", "Textured quiff with a trimmed beard", "beard", False),
]

# (day offset, time, name, service, barber, phone, status, source)
SAMPLE_BOOKINGS = [
    (0, 630, "Marcus Bell", "fade", "tania", "519-555-0147", "confirmed", "online"),
    (0, 690, "Graham Whitfield", "senior", "any", "519-555-0183", "confirmed", "phone"),
    (0, 930, "Daniel Okafor", "cut-beard", "tania", "519-555-0112", "requested", "online"),
    (0, 990, "Luis Ferreira", "classic", "any", "519-555-0165", "requested", "online"),
    (1, 600, "Tom Kowalski", "beard", "any", "519-555-0129", "confirmed", "phone"),
    (1, 960, "Ethan Moreau", "kids", "tania", "519-555-0171", "requested", "online"),
    (2, 660, "Bill Hendry", "hot-towel", "tania", "519-555-0104", "confirmed", "online"),
    (-1, 720, "Sam Achebe", "fade", "any", "519-555-0138", "done", "online"),
    (-1, 780, "Owen Price", "classic", "tania", "519-555-0192", "no-show", "phone"),
]
SAMPLE_BOOKING_NOTE = (2, "Keeping the length on top, just clean it up.")

# (minutes ago, name, phone, body, read)
SAMPLE_MESSAGES = [
    (40, "Carol Mitchell", "519-555-0158",
     "Hi, my father uses a walker. Is there a step at the front door, and is there parking close by?", False),
    (5 * 60, "Jordan Reyes", "519-555-0176", "Do you do flat tops? Looking for someone who can do one properly.", False),
    (2 * 24 * 60, "Peter Lang", "519-555-0120", "Will you be open the Saturday of the long weekend?", True),
]

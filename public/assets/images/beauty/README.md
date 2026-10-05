# Portrait collection

These thirty original, fully clothed adult fashion portraits were generated with
OpenAI image generation for Jungle Gems. They depict fictional people and do not
use photographs or likenesses of named real people.

- `garden.webp`: ivory blouse in a sunlit botanical garden.
- `sunset.webp`: blue dress against golden-hour architecture and flowers.
- `city.webp`: rose blazer in a twilight rooftop garden.
- `coast.webp`: white linen dress on a Mediterranean coast.
- `forest.webp`: emerald field jacket in a woodland clearing.
- `meadow.webp`: lavender dress in a wildflower meadow.
- `autumn.webp`: camel coat and cream scarf beside autumn leaves.
- `blossom.webp`: pale pink outfit in a cherry blossom garden.
- `snow.webp`: navy winter coat and white scarf in an alpine village.
- `starlight.webp`: navy coat and scarf on a rooftop beneath the stars.

- `lake.webp`: sage sweater by a mountain lake.
- `lavender.webp`: cardigan among lavender fields.
- `desert.webp`: sand-colored shirt and scarf at an oasis.
- `harbor.webp`: navy jacket at a fishing harbor.
- `cafe.webp`: burgundy blouse on a café terrace.
- `orchard.webp`: cream sweater in an apple orchard.
- `waterfall.webp`: emerald outdoor jacket by a waterfall.
- `library.webp`: tweed blazer in a library.
- `rainbow.webp`: yellow raincoat in a park beneath a rainbow.
- `terrace.webp`: coral blouse on a Mediterranean terrace.
- `bamboo.webp`: teal jacket among bamboo.
- `rose.webp`: dusty rose coat in a rose garden.
- `countryside.webp`: sweater and brown jacket beside wheat fields.
- `marina.webp`: sky-blue jacket by sailboats.
- `moonlight.webp`: gray coat and scarf by a moonlit lake.
- `festival.webp`: modest colorful kurta on a lantern-lined street.
- `cliff.webp`: navy windbreaker on coastal cliffs.
- `bridge.webp`: burgundy coat beside a stone bridge.
- `island.webp`: turquoise shirt on a tropical island walkway.
- `spring.webp`: peach sweater among white blossoms.

Runtime assets are 640×800 WebP files at quality 82. Source PNGs are kept in
the task's `/workspace/generated_images` directory; runtime files keep the same
composition and are fitted to the portrait frame before encoding. Levels request
only their own portrait. To add more, extend `PHOTO_LEVELS` in
`src/beauty/PhotoRules.js`, add a translated title and a matching WebP here.

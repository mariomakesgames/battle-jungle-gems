# Portrait collection

These ten original, fully clothed adult fashion portraits were generated with
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

Runtime assets are 640×800 WebP files at quality 82. Source PNGs are kept in
the task's `/workspace/generated_images` directory; runtime files keep the same
composition and are fitted to the portrait frame before encoding. Levels request
only their own portrait. To add more, extend `PHOTO_LEVELS` in
`src/beauty/PhotoRules.js`, add a translated title and a matching WebP here.

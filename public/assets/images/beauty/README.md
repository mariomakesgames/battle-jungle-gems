# Portrait collection

These three original, fully clothed adult fashion portraits were generated with
OpenAI image generation for Jungle Gems. They depict fictional people and do not
use photographs or likenesses of named real people.

- `garden.webp`: ivory blouse in a sunlit botanical garden.
- `sunset.webp`: blue dress against golden-hour architecture and flowers.
- `city.webp`: rose blazer in a twilight rooftop garden.

Runtime assets are 640 px wide WebP files at quality 82. Source PNGs are kept in
the task's `/workspace/generated_images` directory; runtime files keep the same
composition and only change resolution/encoding. Levels request only their own
portrait. To add more, extend `PHOTO_LEVELS` in `src/beauty/PhotoRules.js`, add a
translated title and a matching WebP here.

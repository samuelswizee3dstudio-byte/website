// SAMPLE DATA ONLY — used when STRIPE_SECRET_KEY is absent so the site can be
// built and worked on locally before the real Stripe account exists.
// A Netlify production build with no key fails instead of using this.
// Shape mirrors the Stripe API responses that catalogue.mjs normalises.

const img = (n) => `/images/samples/${n}.svg`;

export const FIXTURE_PRODUCTS = {
  products: [
    {
      id: 'prod_sample_axolotl', active: true, name: 'Axolotl Fidget Buddy',
      description: 'A wiggly articulated axolotl that actually moves. Printed in one piece, no glue, no batteries. Pick your colour.',
      images: [img('axolotl')],
      metadata: { category: 'axolotls', sort: '10', featured: 'true' },
    },
    {
      id: 'prod_sample_nameplate', active: true, name: 'Name Plate',
      description: 'Your name, printed big and bold. Stands up on a shelf or a desk. Letters and numbers only.',
      images: [img('nameplate')],
      metadata: { category: 'name-items', personalise: 'true', personalise_label: 'Name to print', sort: '20', featured: 'true' },
    },
    {
      id: 'prod_sample_hexfidget', active: true, name: 'Hex Fidget Spinner',
      description: 'Smooth six-sided spinner. Quiet enough for the back of the classroom.',
      images: [img('hex')],
      metadata: { category: 'fidgets', sort: '30', featured: 'true' },
    },
    {
      id: 'prod_sample_keyring', active: true, name: 'Personalised Keyring',
      description: 'A chunky keyring with your name on it. Comes with a split ring.',
      images: [img('keyring')],
      metadata: { category: 'name-items', personalise: 'true', sort: '40' },
    },
  ],
  prices: [
    { id: 'price_sample_axolotl', active: true, currency: 'gbp', type: 'one_time', unit_amount: 600, product: 'prod_sample_axolotl', nickname: null, metadata: {} },
    { id: 'price_sample_name_3', active: true, currency: 'gbp', type: 'one_time', unit_amount: 500, product: 'prod_sample_nameplate', nickname: null, metadata: { variant_label: 'Up to 4 letters', sort: '1' } },
    { id: 'price_sample_name_6', active: true, currency: 'gbp', type: 'one_time', unit_amount: 700, product: 'prod_sample_nameplate', nickname: null, metadata: { variant_label: '5 to 7 letters', sort: '2' } },
    { id: 'price_sample_name_10', active: true, currency: 'gbp', type: 'one_time', unit_amount: 900, product: 'prod_sample_nameplate', nickname: null, metadata: { variant_label: '8 to 10 letters', sort: '3' } },
    { id: 'price_sample_hex', active: true, currency: 'gbp', type: 'one_time', unit_amount: 400, product: 'prod_sample_hexfidget', nickname: null, metadata: {} },
    { id: 'price_sample_keyring', active: true, currency: 'gbp', type: 'one_time', unit_amount: 350, product: 'prod_sample_keyring', nickname: null, metadata: {} },
  ],
};

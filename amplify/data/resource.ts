import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
  Krathong: a
    .model({
      name: a.string().required(),
      wish: a.string().required(),
      color: a.string().required(),
      kind: a.string(),
    })
    .authorization((allow) => [allow.publicApiKey().to(['create', 'read'])]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: { expiresInDays: 365 },
  },
});

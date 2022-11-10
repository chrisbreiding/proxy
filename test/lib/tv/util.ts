import nock from 'nock'

export function nockLogin (apikey: string, pin: string) {
  return nock('https://api4.thetvdb.com')
  .post('/v4/login', { apikey, pin })
  .reply(200, { data: { token: 'token' } })
}

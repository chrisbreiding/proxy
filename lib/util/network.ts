import axios, { Method } from 'axios'

interface RequestOptions {
  url: string
  body?: object
  headers?: { [key: string]: string }
  params?: { [key: string]: string }
  method?: Method
}

export async function request ({ url, body, headers, params, method = 'get' }: RequestOptions) {
  try {
    const response = await axios({
      method,
      url,
      headers,
      params,
      data: body,
    })

    return response.data
  } catch (error: any) {
    /* eslint-disable no-console */
    console.log('--- axios error ---')
    console.log({ url, body, headers, params, method })
    console.log()
    console.log({
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      code: error?.data?.code,
      message: error?.data?.message,
      stack: error?.stack,
    })
    console.log()
    console.trace()
    console.log('-------------------')
    /* eslint-enable no-console */

    throw error
  }
}

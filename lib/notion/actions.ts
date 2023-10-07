import type express from 'express'
import { addUpcomingWeek } from './upcoming-week'
import { clearCompleted, deleteRecentlyCleared } from './clear-completed'
import { sendHtml, sendHtmlError } from './util/general'
import { promoteDay } from './promote-day'

function sendSuccess (res: express.Response, message: string) {
  sendHtml(res, 200,
    `<!DOCTYPE html>
    <html>
      <body>
        <h2 style="margin: 20px;">${message}<h2>
      </body>
    </html>`,
  )
}

function sendError (res: express.Response, error: any, message: string, statusCode = 500) {
  sendHtmlError({
    error,
    message,
    res,
    statusCode,
  })
}

export function action (req: express.Request, res: express.Response) {
  const action = req.query.action

  if (!action) {
    sendHtml(res, 400, '<p>A value for <em>action</em> must be provided in the query string</p>')

    return
  }

  const onSuccess = sendSuccess.bind(null, res)
  const onError = sendError.bind(null, res)

  switch (action) {
    case 'addUpcomingWeek':
      return addUpcomingWeek(req, onSuccess, onError)
    case 'clearCompleted':
      return clearCompleted(req, onSuccess, onError)
    case 'deleteRecentlyCleared':
      return deleteRecentlyCleared(req, onSuccess, onError)
    case 'promoteDay':
      return promoteDay(req, onSuccess, onError)
    default:
      sendHtml(res, 400, `<p>Action not supported: ${action}</p>`)
  }
}


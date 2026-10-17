import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[outfit-rewind] 渲染出错', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="page">
        <section className="card">
          <h2>这一页出了点问题</h2>
          <p className="muted">
            别的页面还能用。如果反复出现，可以回首页，或者清空本机数据后重新导入。
          </p>
          <pre className="error-detail">{this.state.error.message}</pre>
          <div className="actions">
            <button className="btn" onClick={() => this.setState({ error: null })}>
              重试
            </button>
            <a className="btn btn-ghost" href="#/">
              回首页
            </a>
            <button
              className="btn btn-ghost"
              onClick={() => {
                localStorage.removeItem('outfit-rewind:last-weather')
                this.setState({ error: null })
              }}
            >
              清缓存重试
            </button>
          </div>
        </section>
      </div>
    )
  }
}

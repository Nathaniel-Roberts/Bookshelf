import { Component, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'

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

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
          <TriangleAlert size={48} className="text-red" />
          <h1 className="text-xl font-bold text-text">Something went wrong</h1>
          <p className="max-w-md text-sm text-subtext0 break-all">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-mauve px-4 py-2 font-medium text-base"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

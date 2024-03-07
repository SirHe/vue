import { isString } from '../shared/general'
import { createRenderer } from '../runtime-core/renderer.js'
import { nodeOps } from './nodeOps.js'
import { patchProp } from './patchProp.js'

const rendererOptions = { patchProp, ...nodeOps }
let renderer

function ensureRenderer() {
    return (
        renderer ||
        (renderer = createRenderer(rendererOptions))
    )
}

export const createApp = (...args) => {
    const app = ensureRenderer().createApp(...args)

    const { mount } = app
    app.mount = (containerOrSelector) => {
        // 可以支持 '#app' 和 元素
        const container = normalizeContainer(containerOrSelector)
        if (!container) return

        // clear content before mounting
        container.innerHTML = ''
        const proxy = mount(container, false, resolveRootNamespace(container))
        if (container instanceof Element) {
            container.removeAttribute('v-cloak')
            container.setAttribute('data-v-app', '')
        }
        return proxy
    }

    return app
}

function normalizeContainer(container) {
    if (isString(container)) {
        return document.querySelector(container)
    }
    return container
}
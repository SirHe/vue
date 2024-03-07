import { createAppAPI } from './apiCreateApp.js'

const unmount = (
    vnode,
    parentComponent,
    parentSuspense,
    doRemove = false,
    optimized = false
) => {

}

// 处理普通html元素
const processElement = (n1, n2, container) => {
    if (n1 == null) {
        mountElement(n2, container)
    } else {
        patchElement(n1, n2)
    }
}

// 对比两个虚拟DOM的不同，并且调用渲染API，将差异更新到真实渲染环境中
const patch = (n1, n2, container) => {
    const { type } = n2
    switch (type) {
        case Text:
            // processText(...)
            break
        case Comment:
            // processCommentNode(...)
            break
        case Static:
            // processStatic(...)
            break
        case Fragment:
            // processFragment(...)
            break
        default:
            processElement(n1, n2, container)
    }
}

const render = (vnode, container) => {
    if (vnode == null) {
        if (container._vnode) {
            unmount(container._vnode, null, null, true)
        }
    } else {
        patch(container._vnode || null, vnode, container, null, null, null)
    }
    container._vnode = vnode
}

export const createRenderer = (options) => {
    return {
        render,
        hydrate,
        createApp: createAppAPI(render, hydrate),
    }
}

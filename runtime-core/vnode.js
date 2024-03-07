export function isSameVNodeType(n1, n2) {
    return n1.type === n2.type && n1.key === n2.key
}

export function createVNode(
    type,
    props,
    children,
    patchFlag,
    dynamicProps,
    isBlockNode = false,
) {
    if (!type || type === NULL_DYNAMIC_COMPONENT) {
        if (__DEV__ && !type) {
            warn(`Invalid vnode type when creating vnode: ${type}.`)
        }
        type = Comment
    }

    if (isVNode(type)) {
        // createVNode receiving an existing vnode. This happens in cases like
        // <component :is="vnode"/>
        // #2078 make sure to merge refs during the clone instead of overwriting it
        const cloned = cloneVNode(type, props, true /* mergeRef: true */)
        if (children) {
            normalizeChildren(cloned, children)
        }
        if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock) {
            if (cloned.shapeFlag & ShapeFlags.COMPONENT) {
                currentBlock[currentBlock.indexOf(type)] = cloned
            } else {
                currentBlock.push(cloned)
            }
        }
        cloned.patchFlag |= PatchFlags.BAIL
        return cloned
    }

    // class component normalization.
    if (isClassComponent(type)) {
        type = type.__vccOpts
    }

    // 2.x async/functional component compat
    if (__COMPAT__) {
        type = convertLegacyComponent(type, currentRenderingInstance)
    }

    // class & style normalization.
    if (props) {
        // for reactive or proxy objects, we need to clone it to enable mutation.
        props = guardReactiveProps(props)!
        let { class: klass, style } = props
        if (klass && !isString(klass)) {
            props.class = normalizeClass(klass)
        }
        if (isObject(style)) {
            // reactive state objects need to be cloned since they are likely to be
            // mutated
            if (isProxy(style) && !isArray(style)) {
                style = extend({}, style)
            }
            props.style = normalizeStyle(style)
        }
    }

    // encode the vnode type information into a bitmap
    const shapeFlag = isString(type)
        ? ShapeFlags.ELEMENT
        : __FEATURE_SUSPENSE__ && isSuspense(type)
            ? ShapeFlags.SUSPENSE
            : isTeleport(type)
                ? ShapeFlags.TELEPORT
                : isObject(type)
                    ? ShapeFlags.STATEFUL_COMPONENT
                    : isFunction(type)
                        ? ShapeFlags.FUNCTIONAL_COMPONENT
                        : 0

    if (__DEV__ && shapeFlag & ShapeFlags.STATEFUL_COMPONENT && isProxy(type)) {
        type = toRaw(type)
        warn(
            `Vue received a Component that was made a reactive object. This can ` +
            `lead to unnecessary performance overhead and should be avoided by ` +
            `marking the component with \`markRaw\` or using \`shallowRef\` ` +
            `instead of \`ref\`.`,
            `\nComponent that was made reactive: `,
            type,
        )
    }

    return createBaseVNode(
        type,
        props,
        children,
        patchFlag,
        dynamicProps,
        shapeFlag,
        isBlockNode,
        true,
    )
}

function createBaseVNode(
    type: VNodeTypes | ClassComponent | typeof NULL_DYNAMIC_COMPONENT,
    props: (Data & VNodeProps) | null = null,
    children: unknown = null,
    patchFlag = 0,
    dynamicProps: string[] | null = null,
    shapeFlag = type === Fragment ? 0 : ShapeFlags.ELEMENT,
    isBlockNode = false,
    needFullChildrenNormalization = false,
  ) {
    const vnode = {
      __v_isVNode: true,
      __v_skip: true,
      type,
      props,
      key: props && normalizeKey(props),
      ref: props && normalizeRef(props),
      scopeId: currentScopeId,
      slotScopeIds: null,
      children,
      component: null,
      suspense: null,
      ssContent: null,
      ssFallback: null,
      dirs: null,
      transition: null,
      el: null,
      anchor: null,
      target: null,
      targetAnchor: null,
      staticCount: 0,
      shapeFlag,
      patchFlag,
      dynamicProps,
      dynamicChildren: null,
      appContext: null,
      ctx: currentRenderingInstance,
    } as VNode
  
    if (needFullChildrenNormalization) {
      normalizeChildren(vnode, children)
      // normalize suspense children
      if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
        ;(type as typeof SuspenseImpl).normalize(vnode)
      }
    } else if (children) {
      // compiled element vnode - if children is passed, only possible types are
      // string or Array.
      vnode.shapeFlag |= isString(children)
        ? ShapeFlags.TEXT_CHILDREN
        : ShapeFlags.ARRAY_CHILDREN
    }
  
    // validate key
    if (__DEV__ && vnode.key !== vnode.key) {
      warn(`VNode created with invalid key (NaN). VNode type:`, vnode.type)
    }
  
    // track vnode for block tree
    if (
      isBlockTreeEnabled > 0 &&
      // avoid a block node from tracking itself
      !isBlockNode &&
      // has current parent block
      currentBlock &&
      // presence of a patch flag indicates this node needs patching on updates.
      // component nodes also should always be patched, because even if the
      // component doesn't need to update, it needs to persist the instance on to
      // the next vnode so that it can be properly unmounted later.
      (vnode.patchFlag > 0 || shapeFlag & ShapeFlags.COMPONENT) &&
      // the EVENTS flag is only for hydration and if it is the only flag, the
      // vnode should not be considered dynamic due to handler caching.
      vnode.patchFlag !== PatchFlags.NEED_HYDRATION
    ) {
      currentBlock.push(vnode)
    }
  
    if (__COMPAT__) {
      convertLegacyVModelProps(vnode)
      defineLegacyVNodeProperties(vnode)
    }
  
    return vnode
  }
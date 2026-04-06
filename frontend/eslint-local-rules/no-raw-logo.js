// eslint-local-rules/no-raw-logo.js
// Règle ESLint — interdit d'écrire le logo VoxFlow en texte brut
// Utilisez toujours <VoxFlowLogo /> depuis @/components/shared/VoxFlowLogo
'use strict'

module.exports = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Use <VoxFlowLogo /> instead of raw text logo' },
    messages: {
      noRawLogo: 'Use <VoxFlowLogo /> from @/components/shared/VoxFlowLogo instead of writing the logo manually.',
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === 'string' && /vox\s+flow/i.test(node.value)) {
          context.report({ node, messageId: 'noRawLogo' })
        }
      },
      JSXText(node) {
        if (/vox\s+flow/i.test(node.value)) {
          context.report({ node, messageId: 'noRawLogo' })
        }
      },
    }
  },
}

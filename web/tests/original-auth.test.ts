import { mountSuspended } from '@nuxt/test-utils/runtime'
import { expect, test } from 'vitest'
import OriginalAuthScreen from '../app/components/OriginalAuthScreen.vue'

test('o login original preserva as abas, valida as credenciais e emite o login normalizado', async () => {
  const screen = await mountSuspended(OriginalAuthScreen, { props: { busy: false, feedback: '' } })
  try {
    expect(screen.get('main h1').text()).toContain('Seu treino.')
    await screen.find('form').trigger('submit')
    expect(screen.get('[role="alert"]').text()).toContain('e-mail válido')
    await screen.get('#auth-email').setValue(' TESTE@example.com ')
    await screen.get('#auth-password').setValue('senha-segura')
    await screen.find('form').trigger('submit')
    expect(screen.emitted('submit')).toEqual([['login', { email: 'teste@example.com', password: 'senha-segura', name: '' }]])
    await screen.findAll('[role="tab"]')[1]!.trigger('click')
    expect(screen.get('#auth-name').attributes('autocomplete')).toBe('name')
    expect(screen.get('#auth-password').attributes('autocomplete')).toBe('new-password')
    await screen.get('#auth-name').setValue('Herói Teste')
    await screen.get('#auth-password').setValue('senha-segura')
    await screen.find('form').trigger('submit')
    expect(screen.emitted('submit')?.[1]).toEqual(['register', { email: 'teste@example.com', password: 'senha-segura', name: 'Herói Teste' }])
  } finally {
    screen.unmount()
  }
})

test('a recuperação não exige senha e o Google usa o evento de autenticação existente', async () => {
  const screen = await mountSuspended(OriginalAuthScreen, { props: { busy: false, feedback: '' } })
  try {
    await screen.findAll('button').find(button => button.text() === 'Esqueci minha senha')!.trigger('click')
    expect(screen.find('#auth-password').exists()).toBe(false)
    await screen.get('#auth-email').setValue('teste@example.com')
    await screen.find('form').trigger('submit')
    expect(screen.emitted('submit')).toEqual([['recover', { email: 'teste@example.com', password: '', name: '' }]])
    await screen.findAll('button').find(button => button.text().includes('Entrar com Google'))!.trigger('click')
    expect(screen.emitted('google')).toHaveLength(1)
    await screen.setProps({ busy: true })
    expect(screen.findAll('button').find(button => button.text().includes('Conectando'))?.attributes('disabled')).toBeDefined()
  } finally {
    screen.unmount()
  }
})

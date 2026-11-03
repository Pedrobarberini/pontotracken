export function registrationInvitation(person, baseURI) {
  const url = new URL('./', baseURI);
  url.search = '';
  url.hash = 'cadastro';
  return `Olá, ${person.name}!\n\nSeu pré-cadastro no Tracken Pessoas foi preparado. Crie sua conta usando o e-mail ${person.email}:\n${url.href}\n\nSe já possui uma conta, entre com esse mesmo e-mail. Depois do primeiro acesso, aguarde a vinculação e a aprovação pela empresa.`;
}

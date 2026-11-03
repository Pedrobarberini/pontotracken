function unavailablePolicy() {
  return Object.assign(new Error('Não foi possível conferir as regras de senha. Verifique sua conexão e tente novamente.'), {
    code: 'REGISTRATION_POLICY_UNAVAILABLE'
  });
}

function missingRequirements(status) {
  const rules = status.passwordPolicy?.customStrengthOptions || {};
  const missing = [];
  if (status.meetsMinPasswordLength === false) {
    missing.push(Number.isInteger(rules.minPasswordLength) ? `pelo menos ${rules.minPasswordLength} caracteres` : 'o tamanho mínimo exigido');
  }
  if (status.meetsMaxPasswordLength === false) {
    missing.push(Number.isInteger(rules.maxPasswordLength) ? `no máximo ${rules.maxPasswordLength} caracteres` : 'o tamanho máximo permitido');
  }
  for (const [field, description] of [
    ['containsLowercaseLetter', 'uma letra minúscula'],
    ['containsUppercaseLetter', 'uma letra maiúscula'],
    ['containsNumericCharacter', 'um número'],
    ['containsNonAlphanumericCharacter', 'um caractere especial']
  ]) {
    if (status[field] === false) missing.push(description);
  }
  return missing;
}

// Firebase remains authoritative. Do not copy password validation rules into
// the Worker or send a password to the application's API.
export async function createPasswordAccount(auth, authModule, email, password) {
  let status;
  try {
    status = await authModule.validatePassword(auth, password);
  } catch {
    throw unavailablePolicy();
  }
  if (typeof status?.isValid !== 'boolean') throw unavailablePolicy();
  if (!status.isValid) {
    const missing = missingRequirements(status);
    throw Object.assign(new Error(missing.length
      ? `Sua senha precisa ter: ${missing.join('; ')}.`
      : 'Sua senha não atende às regras de segurança da empresa. Escolha outra senha.'), {
      code: 'REGISTRATION_PASSWORD_POLICY_UNMET'
    });
  }
  return authModule.createUserWithEmailAndPassword(auth, email, password);
}

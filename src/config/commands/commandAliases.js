/**
 * Command Aliases Configuration
 * Maps shortened command names to their full command names
 */

export const commandAliases = {
    'bal': 'saldo',
    'money': 'saldo',
    'cash': 'saldo',

    'dep': 'depositar',
    'with': 'retirar',
    'work': 'trabajar',
    'daily': 'diario',
    'gamble': 'apostar',
    'bet': 'apostar',
    'rob': 'robar',
    'crime': 'delito',
    'pay': 'pagar',
    'give': 'pagar',
    'send': 'pagar',

    'ping': 'ping',
    'help': 'ayuda',
    'h': 'ayuda',
    'info': 'ayuda',

    'ban': 'banear',
    'kick': 'expulsar',
    'mute': 'silenciar-temporalmente',
    'warn': 'advertir',
    'clear': 'limpiar',
    'purge': 'limpiar',
    'untimeout': 'quitar-silencio',
    'unmute': 'quitar-silencio',

    'rank': 'rango',
    'lvl': 'rango',
    'xp': 'rango',
    'leaderboard': 'clasificacion',
    'lb': 'clasificacion',
    'top': 'clasificacion',

    'shop': 'tienda',
    'buy': 'comprar',
    'inventory': 'inventario',
    'inv': 'inventario',
    'items': 'inventario',

    'user': 'info-usuario',
    'avatar': 'avatar',
    'pfp': 'avatar',
    'icon': 'avatar',

    'bd': 'cumpleanos',
    'bday': 'cumpleanos',
    'b': 'cumpleanos',

    'flip': 'moneda',
    'coin': 'moneda',
    'roll': 'dado',
    'dice': 'dado',
    'fight': 'pelear',

    'gcreate': 'crear-sorteo',
    'gstart': 'crear-sorteo',
    'gend': 'finalizar-sorteo',
    'gstop': 'finalizar-sorteo',
    'gdelete': 'borrar-sorteo',
    'greroll': 'resortear',
    'groll': 'resortear',

    'ticket': 'ticket',
    't': 'ticket',
    'new': 'ticket',

    'ver': 'verificar',
    'vadmin': 'verificacion',
    'av': 'autoverify',

    'welcome': 'bienvenida',
    'greet': 'saludar',
    'goodbye': 'despedida',
    'autorole': 'rol-automatico',

    'calc': 'calcular',
    'math': 'calcular',
    'weather': 'clima',
    'todo': 'pendientes',
    'report': 'reportar',
    'userinfo': 'info-usuario',
    'whois': 'info-usuario',
    'ui': 'info-usuario',

    'serverstats': 'estadisticas-servidor',
    'ss': 'estadisticas-servidor',
    'sstats': 'estadisticas-servidor',

    'rr': 'roles-reaccion',
    'reactionroles': 'roles-reaccion',

    'jtc': 'unir-para-crear',
    'jointocreate': 'unir-para-crear',

    'np': 'sonando',
    'now': 'sonando',
};

export const subcommandAliases = {
    'l': 'list',
    'ls': 'list',
    's': 'set',
    'i': 'info',
    'r': 'remove',
    'rm': 'remove',
    'del': 'remove',
    'n': 'next',
    'sc': 'setchannel',

    'a': 'add',
    'c': 'complete',
    'done': 'complete',
    'd': 'complete',

    'start': 'create',
    'stop': 'end',
    'roll': 'reroll',

    'add': 'add',
    'remove': 'remove',
    'list': 'list',
};

/**
 * Resolve a command alias to its full command name
 * @param {string} commandName - The command name (could be an alias)
 * @returns {string} - The full command name, or the original if not an alias
 */
export function resolveCommandAlias(commandName) {
    const normalized = commandName.toLowerCase();
    return commandAliases[normalized] || commandName;
}

/**
 * Resolve a subcommand alias to its full subcommand name
 * @param {string} subcommandName - The subcommand name (could be an alias)
 * @returns {string} - The full subcommand name, or the original if not an alias
 */
export function resolveSubcommandAlias(subcommandName) {
    const normalized = subcommandName.toLowerCase();
    return subcommandAliases[normalized] || subcommandName;
}

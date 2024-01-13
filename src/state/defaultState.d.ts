
interface GlobalState {
    worldState: {
        server: number
    },
    exploreMode: boolean,
    zoneInfo: {
        zone: number,
        shortName: string,
        longName: string,
        safe_x: number,
        safe_y: number,
        safe_z: number,
        minclip: number,
        maxclip: number,
        fog_minclip: number,
        fog_maxclip: number,
        sky: number,
        fog_density: number,
        safe_heading: number,
        ztype: number,
        zonePoints: Object.<number, {
            x: number,
            y: number,
            z: number,
            target_zone_id: number,
            target_x: number,
            target_y: number,
            target_z: number
        }>
    },
    zonePort: number,
    loginState: {
        success: boolean,
        loggedIn: boolean,
        loading: boolean,
        triedLogin: boolean,
        lsid: number,
        key: string,
        serverList: Array<{ 
            ip: string,
            server_type: number,
            server_id: number,
            server_name: string,
            region: string,
            locale: string,
            status: number,
            players_online: number
        }>,
        characters: Array<{
            
        }>
    },
    character: '',
    ip: string,
    gameState: number,
    chat: {
        chatLines: string[]
    },
    ui: {
        settingsOpen: boolean,
        loading: boolean,
        loadingText: string,
    },
}


export = GlobalState;

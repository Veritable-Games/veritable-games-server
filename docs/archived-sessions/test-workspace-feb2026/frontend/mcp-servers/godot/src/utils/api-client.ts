const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

export class APIClient {
  async get(path: string): Promise<any> {
    const url = `${API_BASE_URL}${path}`;
    console.error(`[Godot MCP] API GET: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async post(path: string, body: any): Promise<any> {
    const url = `${API_BASE_URL}${path}`;
    console.error(`[Godot MCP] API POST: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async put(path: string, body: any): Promise<any> {
    const url = `${API_BASE_URL}${path}`;
    console.error(`[Godot MCP] API PUT: ${url}`);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}

export const apiClient = new APIClient();

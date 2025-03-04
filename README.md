<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

# siproad-products-api
Api central del sistema siproad que permite gestionar elementos, productos y ordenes.

```
- Lenguaje: Nodejs (Nest), typescript.
- Base de Datos: Mariadb.
- Tecnologias: Docker, sns/sqs AWS.
```

## Configuración ambiente dev

### Configuración de la api
* Tener Nest CLI instalado ```npm i -g @nestjs/cli```
* Clonar el proyecto.
* Clonar el archivo __.env.template__ y renombrar la copia a ```.env```
* Configurar los valores de las variables de entornos correspondientes ```.env```
* Actualizar node_modules ```npm install```

### Configuración de la base de datos (docker)
* La configuración se encuentra en el docker-compose del repo siproad-admin-api.

## Configuración ambiente stg

### Configuración de la api
* Apuntar el archivo .env a las variables de staging.
* Crear contenedor de api ```docker-compose -p siproad up -d```

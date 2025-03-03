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

Nota: siproad-admin-api tiene los pasos para la creación de la base de datos en su docker-compose.

## Configuración ambiente stg

### Configuración de la api
* Crear contenedor de api ```docker-compose -p siproad up -d```

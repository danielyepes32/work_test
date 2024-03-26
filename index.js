//librerias necesarias
const mongoose = require('mongoose')
const express = require('express')
const app = express()

//Funciones utilizadas en el codigo
//---------------------------------------------------------------------------------------
//Funcion para obtener precio
function obtenerPrecio(registro) {
    if (registro.price == undefined) {
      return registro.basePrice
    } else if (registro.basePrice == undefined) {
      return registro.price
    } else {
      return null // O algún valor predeterminado si ninguno de los campos está presente
    }
  }

//funcion para obtener stock
function obtenerStock(registro) {
    if (registro.stock == undefined) {
      return registro.inStock
    } else if (registro.inStock == undefined) {
      return registro.stock
    } else {
      return null // O algún valor predeterminado si ninguno de los campos está presente
    }
}  
//----------------------------------------------------------------------------------

// Datos de conexión
const username = "drenvio"
const password = "moM5f3AodwLE5d0A"
const host1 = "ac-aemgtkt-shard-00-00.unqyghm.mongodb.net"
const host2 = "ac-aemgtkt-shard-00-01.unqyghm.mongodb.net"
const host3 = "ac-aemgtkt-shard-00-02.unqyghm.mongodb.net"
const replicaSet = "atlas-y8oxsk-shard-0"

// Cadena de conexión
const uri = `mongodb://${username}:${password}@${host1}:27017,${host2}:27017,${host3}:27017/?replicaSet=${replicaSet}&ssl=true&authSource=admin`

// Conectar a la base de datos
mongoose.set('strictQuery',false)

// Conectar a la base de datos
mongoose.connect(uri).then(async () => {
console.log('Conexión exitosa a la base de datos MongoDB')

//-----------------------------------------------------------------------------------------
//Esta parte del codigo solo es para verificar los esquemas disponibles en la base de datos
// Obtener la lista de colecciones
const collections = await mongoose.connection.db.listCollections().toArray();
    
// Imprimir el nombre de cada colección
console.log('Colecciones disponibles en la base de datos:')
collections.forEach(collection => {
    console.log(collection.name)
    })
})
.catch((error) => {
    console.error('Error al conectar a la base de datos:', error);
  })
//fin del listado de esquemas
//------------------------------------------------------------------------------------------
//Definir esquema de los datos a recopilar en mongoDB
const productSchema = new mongoose.Schema({
    id: String,
    name: String,
    inStock: Boolean,
    stock: Boolean,
    price: Number,
    basePrice: Number,
    brand: {
        type: mongoose.Schema.Types.Mixed, // Puede ser ID de marca o nombre de marca
        ref: 'Brand' // Referencia al esquema de marca
    },
    basePrice: Number,
    specialPrice: Number 
})

//Definir esquema de los datos usuarios
const userSchema = new mongoose.Schema({
    id: Number,
    nombre: String,
    metadata: {
      precios_especiales: [{
        _id: mongoose.Schema.Types.ObjectId,
        nombre_producto: String,
        precio_especial_personal: Number
      }]
    }
})

//esquema generico para visualiar datos
const dataSchema = new mongoose.Schema({
})

// Esquema de la marca (brand)
const brandSchema = new mongoose.Schema({
    name: String,
})

//Definir los datos a extraer
const Product = mongoose.model('Product', productSchema)
const User  = mongoose.model('User', userSchema)
const Brand = mongoose.model('Brand',brandSchema)
const Special = mongoose.model('Ramosdev-brands',dataSchema)


app.get('/', (request, response) => {
  response.send('<h1>Routes</h1><p>.../user</p><p>.../product</p><p>.../price/{:id}/{:product_name}</p>')
})
//Mostrar los brands en la API brands
app.get('/brands', (request, response) => {
    Brand.find({}).select('-__v').then(brands => {
    response.json(brands)
    })
})

//Api para hacer pruebas
app.get('/especiales', (request, response) => {
     Special.find({}).select('-__v').then(brands => {
     response.json(brands)
     })
 })

//Mostrar los productos en la API product
app.get('/product', async (request, response) => {

    const products = await Product.find({}).select('-__v').select('-_id');
  
    // Mapear los productos para transformar el campo brand en el nombre correspondiente
    const mappedProducts = await Promise.all(products.map(async product => {
    if (mongoose.Types.ObjectId.isValid(product.brand)) {
        // Si el campo brand es un ObjectId, buscar el nombre de la marca
        const brand = await Brand.findById(product.brand)
        product.brand = brand ? brand.name : 'Marca desconocida'
    } else {
        // Si el campo brand es una cadena, utilizar el nombre de la marca directamente
    }
  
    return product
    }))
    const filteredProducts = mappedProducts.filter(product => product.name !== undefined)
    response.json(filteredProducts)
    
})

//Api para mostrar el valor final de un producto por el id de usuario y el nombre del producto
app.get('/price/:user_id/:nombre_producto', async (request, response) => {

    //Extraemos por medio del request el id del usuario y el nombre del producto para ser buscados en la base de datos
    const { user_id, nombre_producto } = request.params

    // Buscar el usuario por su ID
    const user = await User.findOne({ id: user_id })
    console.log('el usuario es: ', user)

    //si no se encuentra el usuario se retorna un error y se visualiza en la Api
    if (!user) {
        return response.status(404).json({ error: 'Usuario no encontrado' })
    }

    // Buscar el producto por su nombre
    const product = await Product.findOne({ name: { $regex: new RegExp('^' + nombre_producto + '$', 'i') } })
    //En caso de no encontrar el producto se visualizara en la Api
    if (!product) {
        return response.status(404).json({ error: 'Producto no encontrado en la base de datos' })
    }   

    // Verificar si el cliente tiene un precio especial para la marca del producto
    const brandName = product.name

    //Arreglo con los productos a los que el usuario tiene disponible precios especiales
    const specialPrice = user.metadata.precios_especiales

    let seEncontro = false

    //Se hace un mapeo para encontrar si algun producto especial coincide con el producto asociado a la request de la Api
    specialPrice.map(special => {
        if(special.nombre_producto == brandName){
            
            //En caso de coincidir re retorna una response con los datos necesarios y definiendo que es una oferta personal con el parametro personalOfert
            seEncontro = true
            const stockBrand = obtenerStock(product)

            response.json({productName: brandName,
                userName: user.nombre,
                inStock : stockBrand,
                finalPrice: special.precio_especial_personal,
                personalOfert: true})
            }
        }
    )

    //En caso de que el producto no coincida se retorna el valor base del producto y se da a entender que no es una oferta especial
    if (!seEncontro) {
        const precio = obtenerPrecio(product)
        response.json({productName: brandName,
            userName: user.nombre,
            inStock : obtenerStock(product),
            finalPrice: precio,
            personalOfert: false})}
})


//Mostrar los usuarios en la API users
app.get('/user', (request, response) => {
    User.find({}).select('-__v').select('-_id').then(users => {
    response.json(users)
    })
})

const PORT = 3000

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
})
